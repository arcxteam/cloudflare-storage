# Note: For Delete Global Server Storage in Cloudflare R2 Buckets & S3 AWS

### This script deletes all objects in a specified Cloudflare R2 bucket. It uses the `boto3` library to interact with S3-compatible R2 storage. First, it loads environment variables from a `.env` file, then configures the S3 client with the necessary credentials. The `delete_all_objects` function retrieves and deletes all objects in the bucket, handling pagination and potential errors. The script confirms with the user before proceeding, ensuring the operation cannot be undone.

### Yes, it can be said that the data is stored globally because R2 is compatible with S3. R2, Cloudflare's object storage service, is designed to be globally distributed, leveraging Cloudflare's extensive network to provide low-latency access to data from locations worldwide. This global distribution is one of the key features that make R2 compatible with S3, as it allows for the same kind of global data accessibility and redundancy that S3 offers. Therefore, when you perform operations on an R2 bucket, you can consider the data to be managed on a global scale, similar to S3.

> [!CAUTION]
> **⚠️ Important Warning:** This action is **permanent and irreversible**. Once you run this command, all objects in the specified bucket will be deleted and cannot be recovered. Please double-check your command before executing it.

## <mark>Methode v1 - Very Quickly</mark>

```py
cd cloudflare-storage/backend
python3 delete_buckets.py
```

## <mark>Methode v2 - Quickly</mark>

### Pre: Install AWS CLI on Linux

> Before you can use either method, you must have the AWS Command Line Interface (CLI) installed on your Linux system. The AWS CLI is a unified tool that allows you to manage multiple AWS services from the command line, and it's fully compatible with Cloudflare R2's S3 API.

**Debian/Ubuntu:**
```bash
sudo apt get update
sudo apt get install aws-cli
```

After installation, verify it's working by running:

```bash
aws --version
```

You need to configure the CLI with your Cloudflare R2 credentials. Run the following.

```bash
aws configure
```

You will be prompted to enter the following information:
*   **AWS Access Key ID:** Enter your `R2_ACCESS_KEY_ID`.
*   **AWS Secret Access Key:** Enter your `R2_SECRET_ACCESS_KEY`.
*   **Default region name:** You can enter `auto` or just press `Enter`.
*   **Default output format:** You can enter `json` or just press `Enter`.

#### Delete All Objects in the Bucket
> To make this process easier and avoid manual errors, you can extract your credentials directly from the `.env` file and use them in the command.
First, run this command in your terminal. It will read your `.env` file and store your Account ID and Bucket Name into shell variables for this session.

**Step 1: Extract Credentials into Variables**
> This creates shell variables that are available to subsequent commands.

```bash
cd cloudflare-storage && export R2_ACCOUNT_ID=$(grep "^R2_ACCOUNT_ID=" .env | cut -d'=' -f2) && export R2_BUCKET_NAME=$(grep "^R2_BUCKET_NAME=" .env | cut -d'=' -f2)
```

**Step 2: Run the Deletion**
> Now, you can run the deletion command using the variables you just created. This is safer and prevents typos.

```bash
aws s3 rm s3://$R2_BUCKET_NAME --recursive --endpoint-url https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com
```

*   **Explanation:**
    *   `$R2_BUCKET_NAME` and `$R2_ACCOUNT_ID`: These are the variables you exported in Step 1. The shell automatically substitutes them with their values.

## <mark>Methode v3 - Slow Quickly</mark>

### Cloudflare Dashboard - Using Object Lifecycle Rules (For Automatic Cleanup)
> This is the **best practice** for routine maintenance. It allows you to create rules that automatically delete objects after a certain period, such as cleaning up log files or temporary uploads. This is a "set it and forget it" solution.

#### How to Set Up Lifecycle Rules in the Cloudflare Dashboard

1.  **Navigate to Your Bucket:** Log in to your Cloudflare dashboard and go to **R2 Object Storage**. Click on the bucket you want to manage.

2.  **Go to Settings:** In your bucket's dashboard, click on the **Settings** tab.

3.  **Find Lifecycle Rules:** Scroll down to the **Object Lifecycle Rules** section and click the **"Add rule"** button.

4.  **Configure the Rule:** Fill out the form to define your cleanup policy:
    *   **Rule name:** Give your rule a descriptive name, for example, `Auto-delete files after 30 days`.
    *   **Prefix:** Leave this field blank if you want the rule to apply to all objects in the bucket. If you only want to apply it to files in a specific "folder" (prefix), enter it here (e.g., `logs/`).
    *   **Actions:** From the dropdown menu, select **"Expire current version of object"**.
    *   **Days:** Enter the number of days an object should be kept before it's automatically deleted. For example, enter `30` to delete objects after 30 days.

5.  **Save the Rule:** Click the **"Add rule"** button to save and activate your new lifecycle rule.

Cloudflare will now automatically handle the deletion of objects according to the rule you've created, with no further intervention required from you.
