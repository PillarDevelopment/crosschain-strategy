const fs = require("fs");
const https = require("https");
require('dotenv').config();

const { GITLAB_TOKEN, CI_PROJECT_ID, CI_JOB_TOKEN, ADDRESS_BRANCH } = process.env;

function updateAddresses() {
    const dest = "./config/addresses.json";
    if (fs.existsSync(dest)) {
        console.log("Addresses already existing");
        return Promise.resolve();
    }
    console.log("Start downloading addresses.json");
    return new Promise((resolve, reject) => {

        const file = fs.createWriteStream(dest);
        const project = CI_PROJECT_ID ? CI_PROJECT_ID : '237';
        const branch = ADDRESS_BRANCH ? ADDRESS_BRANCH : 'develop';
        let headers = {}
        if ( CI_JOB_TOKEN ) {
            headers = {
                'JOB-TOKEN': CI_JOB_TOKEN,
            }
        } else {
            headers = {
                'PRIVATE-TOKEN': GITLAB_TOKEN,
            }
        }
        const options = {
            hostname: 'gitlab.pwlnh.com',
            port: 443,
            path: '/api/v4/projects/'+project+'/jobs/artifacts/'+branch+'/raw/config/addresses.json?job=build',
            method: 'GET',
            headers: headers
        }
        const request = https.get(options, (response) => {
            console.log(`Downloading addresses.json from https://${options.hostname}${options.path}`)
            if (response.statusCode === 200) {
                response.pipe(file);
            } else {
                file.close();
                fs.unlink(dest, () => {}); // Delete temp file
                reject(`Server responded with ${response.statusCode}: ${response.statusMessage}`);
            }

            request.on("error", err => {
                file.close();
                fs.unlink(dest, () => {}); // Delete temp file
                reject(err.message);
            });

            file.on("finish", () => {
                console.log("Download Completed");
                resolve();
            });
        });
    });
}

module.exports = { updateAddresses }
