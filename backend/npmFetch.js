const express = require('express');
const readline = require('readline');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const tar = require('tar');
const { pipeline } = require('stream');
const { promisify } = require('util');
const streamPipeline = promisify(pipeline);

require('dotenv').config();
const app = express();

// API URL
const api = "https://registry.npmjs.org/";

// Path to package.json
const packagePath = path.join(__dirname, 'package.json');

// Set port from dotenv file ortemp port
// const port = process.env.PORT || 5000;
const port = 5000;
// Middleware: log requests
app.use((request, result, next) => {
    console.log(request.path, request.method);
    next();
});

// Listen
app.listen(port, () => {
    console.log("Listening on port", port + '\n');
    addOrInstallPackages();
});

async function addOrInstallPackages() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question("Enter command (add or install): ", async (input) => {
        if (input.toLowerCase() === 'add') {
            rl.close();
            getPackageName();
        } else if (input.toLowerCase() === 'install') {
            rl.close();
            await installPackages();
        } else {
            console.log("Error: incorrect command. Please enter 'add' or 'install'.");
            rl.close();
        }
    });
}

function getPackageName() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('Enter package name: ', (packageName) => {
        if (!packageName) {
            console.log('Package name cannot be empty.');
            rl.close();
            return;
        }

        rl.question('Is this a development dependency? (yes/no): ', (isDev) => {
            if (isDev.toLowerCase() !== 'yes' && isDev.toLowerCase() !== 'no') {
                console.log('Invalid input for dependency type. Please enter "yes" or "no".');
                rl.close();
                return;
            }

            rl.close();
            setUpAPI(packageName, isDev.toLowerCase() === 'yes');
        });
    });
}

async function setUpAPI(packageName, isDev) {
    try {
        const url = api + packageName;
        const res = await axios.get(url);

        if (res.status === 200) {
            const latestVersion = res.data['dist-tags'].latest;
            if (res.data.versions && res.data.versions[latestVersion] && res.data.versions[latestVersion].dist) {
                const tarballUrl = res.data.versions[latestVersion].dist.tarball;
                console.log(`Package "${packageName}" found. Version: ${latestVersion}. Tarball URL: ${tarballUrl}`);

                // await downloadAndExtract(tarballUrl, packageName);
                updatePackageJson(packageName, latestVersion, isDev);
            } else {
                console.log(`Error: Could not find dist information for ${packageName}`);
            }
        } else {
            console.log("Error:", res.status);
        }
    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.log('Package not found:', packageName);
        } else {
            console.log('Error:', error.message);
        }
    }
}

async function installPackages() {
    try {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        const allDependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

        for (const packageName in allDependencies) {
            const version = allDependencies[packageName];
            const url = `${api}${packageName}`;
            const res = await axios.get(url);

            if (res.status === 200) {
                if (res.data.versions && res.data.versions[version] && res.data.versions[version].dist) {
                    const tarballUrl = res.data.versions[version].dist.tarball;
                    console.log(`Installing "${packageName}@${version}". Tarball URL: ${tarballUrl}`);

                    await downloadAndExtractTarball(tarballUrl, packageName);
                } else {
                    console.log("Error finding dist inforomation for: ", packageName, "@", version)
                }
            } else {
                console.log(`Error installing ${packageName}:`, res.status);
            }
        }
    } catch (error) {
        console.error('Error installing packages:', error.message);
    }
}

//download and extract tarball from a tarball specific url that is available within the npm registry
async function downloadAndExtractTarball(tarballUrl, packageName) {
    const nodeModulesPath = path.join(__dirname, 'node_modules', packageName);

    if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
        fs.mkdirSync(path.join(__dirname, 'node_modules'));
    }

    try {
        const res = await axios({
            url: tarballUrl,
            responseType: 'stream', // Stream the response for efficient binary data handling
        });

        await streamPipeline(
            res.data,
            tar.x({ cwd: path.join(__dirname, 'node_modules') }, [`package`])
        );

        fs.renameSync(path.join(__dirname, 'node_modules/package'), nodeModulesPath);

        console.log(`Package "${packageName}" installed successfully.`);
    } catch (error) {
        console.error('Error during tarball extraction:', error.message);
    }
}

const updatePackageJson = (packageName, version, isDev) => {
    try {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        const dependenciesField = isDev ? 'devDependencies' : 'dependencies';

        if (!packageJson[dependenciesField]) {
            packageJson[dependenciesField] = {};
        }

        packageJson[dependenciesField][packageName] = version;

        fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2), 'utf8');
        console.log(`Added ${packageName}@${version} to ${dependenciesField} in package.json.`);
    } catch (error) {
        console.error('Error updating package.json:', error.message);
    }
};

//simple verification that package has been installed and can be used
// const is = require('is-thirteen');
// console.log('IS THIRTEEN TEST', is(13).thirteen())