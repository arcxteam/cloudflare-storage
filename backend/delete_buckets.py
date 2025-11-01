import os
import boto3
from dotenv import load_dotenv

# Note: this load data from file .env
load_dotenv()

# Config S3 client, coz this compatible R2 use too
s3_client = boto3.client(
    's3',
    endpoint_url=f"https://{os.getenv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com",
    aws_access_key_id=os.getenv("R2_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY"),
    region_name='auto'
)

def delete_all_objects(bucket_name):
    """Delete all objects in your Buckets"""
    try:
        objects_to_delete = []
        paginator = s3_client.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=bucket_name):
            if 'Contents' in page:
                for obj in page['Contents']:
                    objects_to_delete.append({'Key': obj['Key']})

        if not objects_to_delete:
            print(f"Bucket '{bucket_name}' already empty")
            return

        # Delete all objects w/ one batch
        print(f"Find {len(objects_to_delete)} objects. removing...")
        delete_response = s3_client.delete_objects(
            Bucket=bucket_name,
            Delete={'Objects': objects_to_delete}
        )

        if 'Deleted' in delete_response:
            print(f"Succeesfull delete {len(delete_response['Deleted'])} objects.")
        if 'Errors' in delete_response:
            print(f"Take place {len(delete_response['Errors'])} error while deleting:")
            for error in delete_response['Errors']:
                print(f"  - Failed delete {error['Key']}: {error['Message']}")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == '__main__':
    bucket_name = os.getenv("R2_BUCKET_NAME")
    if not bucket_name:
        print("Error: R2_BUCKET_NAME not found in file .env")
    else:
        print(f"Initiates deletion of all objects in the bucket server global: {bucket_name}")
        confirm = input("Are you sure? This cannot be undone. (yes/no): ")
        if confirm.lower() == 'yes':
            delete_all_objects(bucket_name)
            print("NOTE: The process's global server cloud storage has complete! Now delete the totalLy bucket from your Cloudflare dashboard..")
        else:
            print("Cancelled.")
