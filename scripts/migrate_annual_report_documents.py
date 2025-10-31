#!/usr/bin/env python3
"""Copy annual-report documents from a legacy bucket to the dev bucket and update DynamoDB references.

Usage:
    python migrate_annual_report_documents.py \
        --table bebco-borrower-annual-reportings-stv \
        --legacy-bucket bebco-borrower-staging-documents \
        --target-bucket bebco-borrower-documents-stv-us-east-2-303555290462 \
        --region us-east-2

The script copies any referenced documents that still live in the legacy bucket and
updates `document_url` / `assignment_document_url` attributes to point at the new bucket.
"""

import argparse
import logging
import sys
from typing import Dict, Optional

import boto3
from botocore.exceptions import ClientError


logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Migrate annual report documents to the target bucket")
    parser.add_argument("--table", required=True, help="Annual reportings DynamoDB table name")
    parser.add_argument("--legacy-bucket", required=True, help="Source S3 bucket currently referenced in items")
    parser.add_argument("--target-bucket", required=True, help="Destination S3 bucket in us-east-2")
    parser.add_argument("--region", default="us-east-2", help="AWS region for DynamoDB and the target bucket")
    return parser.parse_args()


def ensure_object_copied(s3_client, legacy_bucket: str, target_bucket: str, key: str) -> None:
    """Copy the object to the target bucket if it is missing."""
    try:
        s3_client.head_object(Bucket=target_bucket, Key=key)
        logger.debug("Object already present: %s", key)
        return
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") != "404":
            raise

    logger.info("Copying %s from %s to %s", key, legacy_bucket, target_bucket)
    s3_client.copy_object(
        Bucket=target_bucket,
        Key=key,
        CopySource={"Bucket": legacy_bucket, "Key": key},
        ServerSideEncryption="AES256",
    )


def migrate_url(
    raw_value: Optional[str],
    legacy_bucket: str,
    target_bucket: str,
    s3_client,
) -> Optional[str]:
    if not raw_value:
        return raw_value

    prefix = f"s3://{legacy_bucket}/"
    if not raw_value.startswith(prefix):
        return raw_value

    key = raw_value[len(prefix):]
    if not key:
        return raw_value

    ensure_object_copied(s3_client, legacy_bucket, target_bucket, key)
    return f"s3://{target_bucket}/{key}"


def migrate_table_items(
    table,
    legacy_bucket: str,
    target_bucket: str,
    s3_client,
) -> Dict[str, int]:
    updated = 0
    scanned = 0
    last_evaluated_key = None

    target_fields = ["document_url", "assignment_document_url"]

    while True:
        scan_kwargs: Dict[str, object] = {}
        if last_evaluated_key:
            scan_kwargs["ExclusiveStartKey"] = last_evaluated_key

        response = table.scan(**scan_kwargs)
        items = response.get("Items", [])
        last_evaluated_key = response.get("LastEvaluatedKey")
        scanned += len(items)

        for item in items:
            key = item.get("id")
            if not key:
                continue

            updates: Dict[str, str] = {}
            for field in target_fields:
                current = item.get(field)
                migrated = migrate_url(current, legacy_bucket, target_bucket, s3_client)
                if migrated and migrated != current:
                    updates[field] = migrated

            if not updates:
                continue

            update_expression = "SET " + ", ".join(f"{field} = :{field}" for field in updates)
            expression_values = {f":{field}": value for field, value in updates.items()}

            table.update_item(
                Key={"id": key},
                UpdateExpression=update_expression,
                ExpressionAttributeValues=expression_values,
            )

            updated += 1
            logger.info("Updated item %s with fields %s", key, list(updates.keys()))

        if not last_evaluated_key:
            break

    return {"scanned": scanned, "updated": updated}


def main() -> int:
    args = parse_args()

    dynamodb = boto3.resource("dynamodb", region_name=args.region)
    table = dynamodb.Table(args.table)
    s3_client = boto3.client("s3", region_name=args.region)

    logger.info(
        "Starting migration for table=%s legacy_bucket=%s target_bucket=%s",
        args.table,
        args.legacy_bucket,
        args.target_bucket,
    )

    stats = migrate_table_items(table, args.legacy_bucket, args.target_bucket, s3_client)
    logger.info("Migration complete: %s", stats)
    return 0


if __name__ == "__main__":
    sys.exit(main())


