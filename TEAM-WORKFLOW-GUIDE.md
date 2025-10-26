# 👥 Team Development Workflow Guide

**Team Size:** 4 Developers  
**Infrastructure:** AWS Serverless (Lambda, API Gateway, DynamoDB)  
**IaC Tool:** AWS CDK (TypeScript)  
**Goal:** Develop and deploy without conflicts

---

## 🏗️ Environment Strategy

### **Environment Tiers**

| Environment | Purpose | Region | Who Uses | Deploy Method |
|-------------|---------|--------|----------|---------------|
| **dev1** | Developer 1's sandbox | us-east-2 | Dev 1 | Direct CLI + CDK |
| **dev2** | Developer 2's sandbox | us-east-2 | Dev 2 | Direct CLI + CDK |
| **dev3** | Developer 3's sandbox | us-east-2 | Dev 3 | Direct CLI + CDK |
| **dev4** | Developer 4's sandbox | us-east-2 | Dev 4 | Direct CLI + CDK |
| **dev** | Shared integration | us-east-2 | All devs | CDK only (PR merge) |
| **staging** | Pre-production | us-east-2 | QA/Lead | CDK only (automated) |
| **prod** | Production | us-east-1 | Lead only | CDK only (manual approval) |

---

## 📁 Repository Structure

```
bebco-infra-cdk-v2/
├── config/
│   └── environments/
│       ├── dev1-us-east-2.json       ← Developer 1
│       ├── dev2-us-east-2.json       ← Developer 2
│       ├── dev3-us-east-2.json       ← Developer 3
│       ├── dev4-us-east-2.json       ← Developer 4
│       ├── dev-us-east-2.json        ← Shared dev
│       ├── staging-us-east-2.json    ← Staging
│       └── prod-us-east-1.json       ← Production
│
├── .git/
│   └── hooks/
│       └── pre-commit                ← Validation checks
│
├── scripts/
│   ├── setup-developer-env.sh        ← Create personal env
│   ├── update-lambda-quick.sh        ← Fast Lambda update
│   ├── sync-to-shared-dev.sh         ← Sync to team env
│   └── deploy-environment.sh         ← Deploy specific env
│
└── docs/
    ├── TEAM-WORKFLOW-GUIDE.md        ← This file
    ├── BRANCHING-STRATEGY.md         ← Git workflow
    └── TROUBLESHOOTING.md            ← Common issues
```

---

## 🔀 Git Branching Strategy

### **Branch Structure**

```
main (production)
  ↓
staging (pre-production)
  ↓
develop (shared dev integration)
  ↓
  ├── feature/user-auth-v2        ← Dev 1
  ├── feature/plaid-integration   ← Dev 2
  ├── feature/reporting-dashboard ← Dev 3
  └── feature/payment-processing  ← Dev 4
```

### **Branch Rules**

| Branch | Protection | Deploy To | Merge Requires |
|--------|-----------|-----------|----------------|
| `main` | 🔒 Protected | prod (us-east-1) | 2 approvals + tests |
| `staging` | 🔒 Protected | staging (us-east-2) | 1 approval + tests |
| `develop` | 🔒 Protected | dev (us-east-2) | 1 approval |
| `feature/*` | ⚠️ Open | dev1/dev2/dev3/dev4 | None (personal) |

---

## 🚀 Developer Workflow

### **Daily Development Flow**

```bash
# ═══════════════════════════════════════════════════════════
# STEP 1: Start Work on Feature
# ═══════════════════════════════════════════════════════════

# Pull latest from develop
git checkout develop
git pull origin develop

# Create feature branch
git checkout -b feature/my-awesome-feature

# ═══════════════════════════════════════════════════════════
# STEP 2: Develop in Personal Environment (dev1/dev2/dev3/dev4)
# ═══════════════════════════════════════════════════════════

# Set your personal environment
export DEV_ENV=dev1  # or dev2, dev3, dev4

# Option A: Quick Lambda update (no CDK deploy)
cd /path/to/lambda/source/plaid-link-token-create
# Edit code...
./scripts/update-lambda-quick.sh plaid-link-token-create . $DEV_ENV

# Option B: Full CDK deploy (for infrastructure changes)
npx cdk deploy BebcoPlaidStack \
  -c environment=$DEV_ENV \
  -c region=us-east-2 \
  --require-approval never

# Test in your personal environment
# API endpoints will be: https://xyz-dev1.execute-api.us-east-2.amazonaws.com

# ═══════════════════════════════════════════════════════════
# STEP 3: Commit Your Changes
# ═══════════════════════════════════════════════════════════

git add .
git commit -m "feat: add awesome feature"
git push origin feature/my-awesome-feature

# ═══════════════════════════════════════════════════════════
# STEP 4: Create Pull Request → develop
# ═══════════════════════════════════════════════════════════

# Create PR in GitHub/GitLab
# Title: "feat: add awesome feature"
# Target: develop
# Reviewers: 1+ team member

# ═══════════════════════════════════════════════════════════
# STEP 5: PR Merged → Auto-Deploy to Shared Dev
# ═══════════════════════════════════════════════════════════

# CI/CD automatically deploys to shared 'dev' environment
# Team can test integration at: https://xyz-dev.execute-api.us-east-2.amazonaws.com

# ═══════════════════════════════════════════════════════════
# STEP 6: Promote to Staging (Lead Developer)
# ═══════════════════════════════════════════════════════════

# Create PR: develop → staging
# On merge: Auto-deploy to staging environment

# ═══════════════════════════════════════════════════════════
# STEP 7: Promote to Production (Manual Approval)
# ═══════════════════════════════════════════════════════════

# Create PR: staging → main
# Requires: 2 approvals + manual deployment trigger
```

---

## 🛠️ Personal Environment Setup

### **One-Time Setup for Each Developer**

```bash
# ═══════════════════════════════════════════════════════════
# Run this once per developer
# ═══════════════════════════════════════════════════════════

cd /Users/steven/Documents/Code/bebco/bebco-infra-cdk-v2

# Developer 1 runs:
./scripts/setup-developer-env.sh dev1

# Developer 2 runs:
./scripts/setup-developer-env.sh dev2

# Developer 3 runs:
./scripts/setup-developer-env.sh dev3

# Developer 4 runs:
./scripts/setup-developer-env.sh dev4
```

This script will:
1. Create `config/environments/dev1-us-east-2.json` (or dev2/dev3/dev4)
2. Deploy full stack to your personal environment
3. Set up your AWS CLI profile
4. Configure environment variables

---

## 🔧 Key Scripts Reference

### **1. Quick Lambda Update (No CDK)**

```bash
# Update a single Lambda function in your personal env
./scripts/update-lambda-quick.sh <function-name> <source-dir> <env>

# Example:
./scripts/update-lambda-quick.sh plaid-link-token-create \
  /path/to/lambda/source dev1
```

**Use when:** Code-only changes, rapid iteration

### **2. Deploy Full Stack**

```bash
# Deploy entire stack to your personal env
./scripts/deploy-environment.sh <env>

# Example:
./scripts/deploy-environment.sh dev1
```

**Use when:** Infrastructure changes, initial setup, major updates

### **3. Deploy Single Stack**

```bash
# Deploy one CDK stack to your personal env
npx cdk deploy BebcoPlaidStack \
  -c environment=dev1 \
  -c region=us-east-2
```

**Use when:** Changes to specific domain (e.g., only Plaid functions)

### **4. Sync to Shared Dev**

```bash
# Test your changes in shared dev environment
./scripts/sync-to-shared-dev.sh
```

**Use when:** Testing integration with other team members' work

---

## 🚦 Conflict Prevention Rules

### **Rule 1: Own Your Environment**
- ✅ **DO:** Work in your personal env (dev1/dev2/dev3/dev4)
- ❌ **DON'T:** Deploy to other developers' environments
- ❌ **DON'T:** Deploy directly to shared `dev` (use PR instead)

### **Rule 2: One Feature = One Branch**
- ✅ **DO:** Create feature branch for each task
- ✅ **DO:** Keep branches short-lived (1-3 days)
- ❌ **DON'T:** Work directly on `develop`, `staging`, or `main`

### **Rule 3: Communicate**
- ✅ **DO:** Announce in Slack when merging to `develop`
- ✅ **DO:** Document breaking changes in PR description
- ✅ **DO:** Tag team members for review on infrastructure changes

### **Rule 4: Test Before PR**
- ✅ **DO:** Test in your personal environment first
- ✅ **DO:** Run `npm run build` before committing
- ✅ **DO:** Verify Lambda functions work in AWS

### **Rule 5: DynamoDB Data**
- ✅ **DO:** Each environment has its own DynamoDB tables
- ✅ **DO:** Use test data in dev environments
- ❌ **DON'T:** Replicate production data to dev (unless necessary)

---

## 📊 Resource Naming Convention

### **Lambda Functions**

| Environment | Naming Pattern | Example |
|-------------|----------------|---------|
| dev1 | `bebco-dev1-<domain>-<action>` | `bebco-dev1-plaid-link-token-create` |
| dev2 | `bebco-dev2-<domain>-<action>` | `bebco-dev2-plaid-link-token-create` |
| dev3 | `bebco-dev3-<domain>-<action>` | `bebco-dev3-plaid-link-token-create` |
| dev4 | `bebco-dev4-<domain>-<action>` | `bebco-dev4-plaid-link-token-create` |
| dev | `bebco-dev-<domain>-<action>` | `bebco-dev-plaid-link-token-create` |
| staging | `bebco-staging-<domain>-<action>` | `bebco-staging-plaid-link-token-create` |
| prod | `bebco-prod-<domain>-<action>` | `bebco-prod-plaid-link-token-create` |

### **DynamoDB Tables**

| Environment | Naming Pattern | Example |
|-------------|----------------|---------|
| dev1 | `bebco-borrower-<table>-dev1` | `bebco-borrower-users-dev1` |
| dev2 | `bebco-borrower-<table>-dev2` | `bebco-borrower-users-dev2` |
| dev (shared) | `bebco-borrower-<table>-dev` | `bebco-borrower-users-dev` |
| staging | `bebco-borrower-<table>-staging` | `bebco-borrower-users-staging` |
| prod | `bebco-borrower-<table>-prod` | `bebco-borrower-users-prod` |

### **API Gateway**

| Environment | Naming Pattern | Example Endpoint |
|-------------|----------------|------------------|
| dev1 | `bebco-borrower-api-dev1` | `https://abc123-dev1.execute-api.us-east-2.amazonaws.com` |
| dev2 | `bebco-borrower-api-dev2` | `https://def456-dev2.execute-api.us-east-2.amazonaws.com` |
| dev | `bebco-borrower-api-dev` | `https://ghi789-dev.execute-api.us-east-2.amazonaws.com` |
| staging | `bebco-borrower-api-staging` | `https://jkl012-staging.execute-api.us-east-2.amazonaws.com` |
| prod | `bebco-borrower-api-prod` | `https://mno345-prod.execute-api.us-east-1.amazonaws.com` |

---

## 🎭 Example Scenarios

### **Scenario 1: Two Devs Working on Different Features**

**Developer 1 (Sarah):** Working on Plaid integration
```bash
# Sarah's workflow
git checkout -b feature/plaid-webhook-handler
# Edit plaid Lambda code
./scripts/update-lambda-quick.sh plaid-webhook-handler . dev1
# Test at https://xyz-dev1.execute-api.us-east-2.amazonaws.com
```

**Developer 2 (Mike):** Working on user authentication
```bash
# Mike's workflow
git checkout -b feature/user-mfa
# Edit auth Lambda code
./scripts/update-lambda-quick.sh users-mfa-verify . dev2
# Test at https://xyz-dev2.execute-api.us-east-2.amazonaws.com
```

**Result:** ✅ No conflicts! Each has separate environment

---

### **Scenario 2: Testing Integration Together**

**Developer 1 (Sarah):** Merges to `develop`
```bash
# Sarah creates PR: feature/plaid-webhook-handler → develop
# PR approved and merged
# CI/CD auto-deploys to shared 'dev' environment
```

**Developer 3 (Alex):** Tests against Sarah's changes
```bash
# Alex's feature depends on Sarah's Plaid work
# Tests at https://xyz-dev.execute-api.us-east-2.amazonaws.com (shared dev)
# If works, Alex creates PR: feature/payment-processing → develop
```

**Result:** ✅ Integration testing in shared dev environment

---

### **Scenario 3: Infrastructure Change (Requires Team Coordination)**

**Developer 4 (Emma):** Adds new DynamoDB table
```bash
# Emma modifies data-stack.ts to add 'bebco-borrower-invoices-v2'
git checkout -b feature/invoices-v2-schema

# Deploy to personal env first
npx cdk deploy BebcoDataStack -c environment=dev4 -c region=us-east-2

# Test thoroughly in dev4

# Create PR with detailed description:
# "⚠️ INFRASTRUCTURE CHANGE: Adds invoices-v2 table"

# Tag all team members for review
```

**Result:** ✅ Team aware of infrastructure change before merge

---

## 📋 Daily Standup Template

### **What to Share**

```markdown
### Developer 1 (Sarah)
**Yesterday:**
- Worked on Plaid webhook handler (feature/plaid-webhook-handler)
- Deployed to dev1, tested successfully

**Today:**
- Finishing Plaid integration
- Will create PR to develop this afternoon

**Blockers:**
- None

**Environment:** dev1
**Merging to develop:** Yes (today)
```

---

## 🚨 Troubleshooting Common Issues

### **Issue 1: "My Lambda isn't updating!"**

**Cause:** Deployed to wrong environment or CDK cached

**Solution:**
```bash
# Check which environment you're in
echo $DEV_ENV

# Force CDK to update
npx cdk deploy BebcoPlaidStack \
  -c environment=dev1 \
  -c region=us-east-2 \
  --force
```

---

### **Issue 2: "I deployed to dev2 by mistake!"**

**Cause:** Wrong environment variable

**Solution:**
```bash
# Revert by deploying correct code to dev2
export DEV_ENV=dev2
git checkout develop  # Get known-good code
./scripts/deploy-environment.sh dev2

# Apologize to Dev 2 😅
```

---

### **Issue 3: "Merge conflict in CDK code!"**

**Cause:** Two devs modified same stack file

**Solution:**
```bash
# Pull latest develop
git checkout develop
git pull origin develop

# Rebase your feature branch
git checkout feature/my-feature
git rebase develop

# Resolve conflicts in IDE
# Test deployment in your personal env
npx cdk deploy <AffectedStack> -c environment=dev1 -c region=us-east-2
```

---

### **Issue 4: "Shared dev is broken!"**

**Cause:** Bad merge to develop branch

**Solution:**
```bash
# Identify the bad commit
git log develop --oneline

# Revert the commit
git revert <bad-commit-hash>
git push origin develop

# CI/CD will auto-deploy the revert to shared dev
```

---

## 📊 Cost Management

### **Estimated Costs Per Environment**

| Environment | Monthly Cost | Notes |
|-------------|--------------|-------|
| dev1 | $50-100 | Personal, low usage |
| dev2 | $50-100 | Personal, low usage |
| dev3 | $50-100 | Personal, low usage |
| dev4 | $50-100 | Personal, low usage |
| dev (shared) | $100-200 | Team integration, higher usage |
| staging | $200-400 | Pre-prod, full data |
| prod | $1,000+ | Production load |
| **Total** | **$1,550-2,000/month** | |

### **Cost Optimization Tips**

1. **Personal Envs:** Delete resources when not actively developing
```bash
# Destroy your personal env when done for the day
npx cdk destroy --all -c environment=dev1 -c region=us-east-2

# Rebuild next morning
./scripts/deploy-environment.sh dev1
```

2. **DynamoDB:** Use on-demand pricing for dev environments

3. **Lambda:** Low usage = minimal cost

4. **API Gateway:** Free tier covers most dev usage

---

## ✅ Pre-Merge Checklist

Before creating a PR to `develop`:

- [ ] Code compiles: `npm run build`
- [ ] Tested in personal environment (dev1/dev2/dev3/dev4)
- [ ] No console errors in Lambda logs
- [ ] API endpoints return expected responses
- [ ] DynamoDB writes/reads work correctly
- [ ] Infrastructure changes documented in PR
- [ ] Breaking changes flagged in PR title
- [ ] Commit messages follow convention (feat/fix/chore)

---

## 🎓 Onboarding New Developers

### **Day 1 Setup (30 minutes)**

```bash
# 1. Clone repository
git clone <repo-url>
cd bebco-infra-cdk-v2

# 2. Install dependencies
npm install

# 3. Configure AWS CLI
aws configure --profile bebco-dev
# Enter: Access Key, Secret Key, us-east-2, json

# 4. Set up personal environment
export DEV_ENV=dev1  # or dev2, dev3, dev4
./scripts/setup-developer-env.sh $DEV_ENV

# 5. Test deployment
npx cdk deploy BebcoPlaidStack \
  -c environment=$DEV_ENV \
  -c region=us-east-2

# Done! You're ready to develop
```

---

## 📞 Team Communication

### **Slack Channels**

- `#bebco-dev` - Daily development chat
- `#bebco-deployments` - Deployment notifications (CI/CD)
- `#bebco-incidents` - Production issues
- `#bebco-prs` - Pull request reviews

### **Deployment Notifications**

CI/CD bot posts:
```
🚀 Deployment to `dev` started
   Branch: feature/plaid-webhook-handler
   Committer: Sarah
   Stacks: BebcoPlaidStack
   Status: In Progress...

✅ Deployment to `dev` complete
   Duration: 2m 34s
   Endpoint: https://xyz-dev.execute-api.us-east-2.amazonaws.com
```

---

## 🎯 Success Metrics

Track these weekly:

- **Deployment Frequency:** How many deploys to shared dev?
- **Merge Time:** How long do PRs stay open?
- **Rollback Rate:** How often do we revert?
- **Environment Health:** Are personal envs being used?
- **Test Coverage:** Are devs testing before PR?

---

## 📚 Additional Resources

- **CDK Documentation:** See `FINAL-DEPLOYMENT-COMPLETE.md`
- **API Testing:** See `API-DEPLOYMENT-COMPLETE.md`
- **Data Migration:** See `DYNAMODB-MIGRATION-COMPLETE.md`
- **Troubleshooting:** See `TROUBLESHOOTING.md`

---

## 🎉 Summary

**Key Principles:**
1. 🏠 Own your personal environment (dev1/dev2/dev3/dev4)
2. 🔀 Use feature branches
3. 🤝 Merge to shared `dev` via PR
4. ✅ Test before merging
5. 💬 Communicate with team

**Result:** 4 developers working harmoniously without conflicts! 🚀

---

*Last Updated: October 26, 2025*  
*Team: 4 Developers*  
*Project: bebco-infra-cdk-v2*

