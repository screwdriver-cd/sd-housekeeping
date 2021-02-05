# sd-housekeeping
Screwdriver Project for House Keeping scripts

## bulk-pipeline-validator
This script checks all pipelines and fetches the screwdriver.yaml for them and validates them with api.
It then writes a csv file with the outpit
Set the following environment variables:
```
SD_TOKEN: Available via a browser at https://api.screwdriver.cd/v4/auth/login/github:github.com/YOUR_USERNAME
SD_API_HOST: https://api.screwdriver.cd
GIT_TOKEN: YOUR_GIT_TOKEN
```
Run (produces a csv output data.csv)
```
npm start 
```