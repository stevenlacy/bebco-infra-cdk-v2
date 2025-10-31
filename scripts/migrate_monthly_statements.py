#!/usr/bin/env python3
"""Copy monthly statement documents from the legacy staging bucket to the us-east-2 documents bucket.

This is required so that the Accounts monthly statements tab can sign URLs from the
environment-specific bucket without referencing any us-east-1 resources.

Example:
    python migrate_monthly_statements.py \
        --legacy-bucket bebco-borrower-staging-documents \
        --target-bucket bebco-borrower-documents-stv-us-east-2-303555290462 \
        --region us-east-2
"""

import argparse
import logging
from typing import Iterable

import boto3
from botocore.exceptions import ClientError


logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)


STATEMENT_PREFIXES: Iterable[str] = (
    "generated-monthly-statements/",
    "sharepoint/",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Copy monthly statement objects to the environment bucket")
    parser.add_argument("--legacy-bucket", required=True, help="Source bucket that currently stores the statements")
    parser.add_argument("--target-bucket", required=True, help="Destination bucket in us-east-2")
    parser.add_argument("--region", default="us-east-2", help="Region for the target bucket")
    return parser.parse_args()


def ensure_object_copied(s3_client, legacy_bucket: str, target_bucket: str, key: str) -> None:
    try:
        s3_client.head_object(Bucket=target_bucket, Key=key)
        logger.debug("Object already exists in target bucket: %s", key)
        return
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") != "404":
            raise

    logger.info("Copying %s", key)
    s3_client.copy_object(
        Bucket=target_bucket,
        Key=key,
        CopySource={"Bucket": legacy_bucket, "Key": key},
        ServerSideEncryption="AES256",
        MetadataDirective="COPY",
    )


def migrate_prefix(s3_client, legacy_bucket: str, target_bucket: str, prefix: str) -> int:
    paginator = s3_client.get_paginator("list_objects_v2")
    copied = 0

    for page in paginator.paginate(Bucket=legacy_bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            ensure_object_copied(s3_client, legacy_bucket, target_bucket, key)
            copied += 1

    return copied


def main() -> int:
    args = parse_args()
    s3_client = boto3.client("s3", region_name=args.region)

    total_copied = 0
    for prefix in STATEMENT_PREFIXES:
        logger.info("Migrating prefix %s", prefix)
        total_copied += migrate_prefix(s3_client, args.legacy_bucket, args.target_bucket, prefix)

    logger.info("Migration complete. Objects ensured in target bucket: %s", total_copied)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())



