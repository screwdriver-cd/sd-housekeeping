'use strict'
const config = require('config');
const requestretry = require('requestretry');
const ScmPlugin = require('screwdriver-scm-router');
const csv = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');

const scmConfig = { scms: config.get('scms') };
const scm = new ScmPlugin(scmConfig || {});

const RETRY_LIMIT = 3;
const RETRY_DELAY = 5;

const SD_API_HOST = process.env.SD_API_HOST;
const SD_TOKEN = process.env.SD_TOKEN
const GIT_TOKEN = process.env.GIT_TOKEN;
async function api(args, body) {
    const options = {
        headers: {
            Authorization: `Bearer ${SD_TOKEN}`,
            'Content-Type': 'application/json'
        },
        url: `${SD_API_HOST}${args.path}`,
        json: true,
        maxAttempts: RETRY_LIMIT,
        retryDelay: RETRY_DELAY * 1000, // in ms
        retryStrategy: (err, response) =>
            !!err || (response.statusCode !== 201 && response.statusCode !== 200),
        ...args,
        body
    };

    return new Promise((resolve, reject) => {
        requestretry(options, (err, response) => {
            if (!err) {
                return resolve(response.body);
            }

            return reject(err);
        });
    });
}

async function getPipelines(pageNumber) {
    const options = {
        path: `/v4/pipelines?page=${pageNumber}&count=50&sort=ascending&sortBy=id`,
        method: 'GET'
    };
    return await api(options);
}

async function fetchSDYaml(config) {
    try {
        return await scm.getFile(config)
    } catch (err) {
        // console.log(err.message);
    };
}

async function validateYaml(yaml) {
    try {
        const options = {
            path: `/v4/validator`,
            method: 'POST',
            'Set-Cookie': 'use_canary=always'
        }
        return await api(options, { yaml })
    } catch (err) {
        // console.log(err.message);
    };
}

function chunkArray(array, size) {
    if (array.length <= size) {
        return [array]
    }
    return [array.slice(0, size), ...chunkArray(array.slice(size), size)]
}

async function writeCsv(rows) {
    const csvWriter = csv({
        path: './data.csv',
        header: [
            { id: 'id', title: 'PipelineId' },
            { id: 'repo', title: 'repo' },
            { id: 'error', title: 'Error' }
        ]
    });
    csvWriter.writeRecords(rows)
}

(async function invoke() {
    let page = 1;
    let total = 0;
    let results = []
    while (page > 0) {
        const pipelines = await getPipelines(page)
        if (pipelines && pipelines.length > 0) {
            total += pipelines.length;
            console.log('Total records processed', total)
            await Promise.all(pipelines.map(async p => {
                const { scmUri, scmContext, scmRepo } = p
                const repoConfig = {
                    scmUri,
                    path: 'screwdriver.yaml',
                    token: GIT_TOKEN,
                    scmContext,
                    scmRepo
                }
                if (scmContext === 'github:git.vzbuilders.com') {
                    const yaml = await fetchSDYaml(repoConfig)
                    if (yaml) {
                        const validationResult = await validateYaml(yaml)
                        if (validationResult && validationResult.errors) {
                            results.push({ id: p.id, repo: p.name, error: validationResult.errors.toString() })
                        }
                    }
                }
            }));
            page++
        } else {
            page = 0
            console.log('finished processing records')
        }
    }
    await writeCsv(results)
})()