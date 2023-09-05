//import { fs } from 'node:fs';
//import url from 'node:url';
//import chalk from "chalk";
const fs = require('node:fs');
const url = require('node:url');
//const chalk = require('chalk')
const http = require('node:http');
const { Readable } = require('stream');

const root = process.env.ROOT_DIR || './frames';
const defaultFramesDir = process.env.DEFAULT_FRAMES || null;
const appHost = process.env.APP_HOST || 'localhost';

const chalk = {
    red(text) {
        return text;
    }
}

class FramesLoaderOptions {
    framesDir;
    reverse = false;
    start = 0;

    constructor(framesDir) {
        this.framesDir = framesDir;
    }
}

const getFramesOptions = (url) => {
    const path = url.path.split('/').filter(str => str.length > 0);

    if (!(0 in path)) {
        if (!defaultFramesDir) {
            throw new Error(`A system error occured!`);
        }

        path.push(defaultFramesDir);
    }

    const dir = path.shift();
    const framesDir = `${root}/${dir}/`;

    if (!fs.existsSync(framesDir) && fs.lstatSync(framesDir).isDirectory()) {
        throw new Error(`Unknown animation ${dir}!`);
    }

    const framesOptions = new FramesLoaderOptions(dir);

    if (!url.searchParams) {
        return framesOptions;
    }

    for (const [name, value] of Object.entries(url.searchParams)) {
        switch (name) {
            case 'reverse':
                framesOptions.reverse = true;
                continue;
            case 'start':
                framesOptions.start = parseInt(value);
                continue;
        }

        throw new Error(`Unknown option provided ${name}!`);
    }

    return framesOptions;
}

const loadFrames = (framesOptions) => {
    const frames = [];
    const dir = `${root}/${framesOptions.framesDir}/`;

    for (const file of fs.readdirSync(dir)) {
        if (['.', '..'].includes(file)) {
            continue;
        }

        frames.push(fs.readFileSync(`${dir}${file}`));
    }

    if (framesOptions.reverse) {
        return frames.reverse();
    }

    return frames;
}

const streamer = (stream, frames, isDesktop) => {
    let index = 0;

    return setInterval(() => {
        // clear the screen
        stream.push("\033[2J\033[3J\033[H");
        let currentFrame = frames[index];

        if (isDesktop) {
            console.log(currentFrame);
            currentFrame = currentFrame.toString().replace('\n', '<br>') + '<br>';
        }

        stream.push(currentFrame);
        //const newColor = lastColor = selectColor(lastColor);

        //stream.push(colors[colorsOptions[newColor]](frames[index]));

        index = (index + 1) % frames.length;
    }, 70);
}

const server = http.createServer((req, res) => {
/*    if (
        req.headers &&
        req.headers['user-agent'] &&
        !req.headers['user-agent'].includes('curl')
    ) {
        return res.end();
    }*/
    const isDesktop = req.headers &&
        req.headers['user-agent'] &&
        typeof req.headers['user-agent'] === 'string' &&
        !req.headers['user-agent'].includes('curl')
    ;

    try {
        const stream = new Readable();
        stream._read = function noop() {};
        stream.pipe(res);

        const urlData = url.parse(req.url);
        const framesOptions = getFramesOptions(urlData);

        const frames = loadFrames(framesOptions);

        const interval = streamer(
            stream,
            frames,
            isDesktop
        );

        req.on('close', () => {
            stream.destroy();

            clearInterval(interval);
        });
    } catch (e) {
        return res.end(chalk.red(e.message + '  ' + e.stack ?? ''))
    }
})

const port = process.env.APP_PORT || 3000;
server.listen(port, err => {
    if (err) throw err;
    console.log(`Listening on ${appHost}:${port}`);
});
