# File storage

`s3.service.ts` is the storage boundary. Private objects are represented in the
database as `s3://<key>` and must be delivered through an authenticated route
using `getSignedS3DownloadUrl`. A private upload intentionally has no public
URL in its result.

`upload.service.ts` is the public-image adapter used by product and warehouse
images. It requests public access explicitly and returns the URL shape those
modules consume.

Required configuration:

```env
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-south-1
S3_BUCKET_NAME=...
```

S3-compatible deployments may also set `S3_ENDPOINT` and
`S3_FORCE_PATH_STYLE=true`. `S3_USE_ACL=true` is only appropriate when the
bucket permits ACLs; otherwise public image access must come from a narrowly
scoped bucket policy.

Object names use sanitized path segments plus a UUID. Callers must validate
file content before upload; a browser-provided MIME type is not sufficient.
