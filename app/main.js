const fs = require("fs")
const fsp = require("fs").promises
const path = require("path");
const zlib = require("zlib")
const crypto = require("crypto");

const command = process.argv[2];

switch (command) {
    case "init":
        createGitDirectory();
        break;
    case "cat-file":
        createCatFileDirectory();
        break;
    case "hash-object":
        createHashObjectDirectory();
        break;
    case "ls-tree":
        createTreeDirectory();
        break;
    case "write-tree":
        writeTreeCommand();
        break;
    case "commit-tree":
        commitTreeCommand();
        break;
    default:
        throw new Error(`Unknown command ${command}`);
}

function createGitDirectory() {
    fs.mkdirSync(path.join(process.cwd(), ".git"), { recursive: true });
    fs.mkdirSync(path.join(process.cwd(), ".git", "objects"), { recursive: true });
    fs.mkdirSync(path.join(process.cwd(), ".git", "refs"), { recursive: true });

    fs.writeFileSync(path.join(process.cwd(), ".git", "HEAD"), "ref: refs/heads/main\n");
    console.log("Initialized git directory");
}

async function createCatFileDirectory() {
    const flag = process.argv[3];
    const Id = process.argv[4];

    if (!Id) {
        process.stdout.write(`
            usage: git cat-file (-t[--allow-unknown-type] | -s[--allow-unknown-type] | -e | -p | <type> | --textconv | --filters) [--path=<path>] <object>
                   or: git cat-file (--batch[=<format>] | --batch-check[=<format>]) [--follow-symlinks] [--textconv | --filters]
            
                <type> can be one of: blob, tree, commit, tag
                    -t                    show object type
                    -s                    show object size
                    -e                    exit with zero when there's no error
                    -p                    pretty-print object's content
                    --textconv            for blob objects, run textconv on object's content
                    --filters             for blob objects, run filters on object's content
                    --path <blob>         use a specific path for --textconv/--filters
                        --allow-unknown-type  allow -s and -t to work with broken/corrupt objects
                        --buffer              buffer --batch output
                        --batch[=<format>]    show info and content of objects fed from the standard input
                            --batch-check[=<format>]
                                show info about objects fed from the standard input
                                --follow-symlinks     follow in-tree symlinks (used with --batch or --batch-check)
                                --batch-all-objects   show all objects with --batch or --batch-check
                                --unordered           do not order --batch-all-objects output
            `);
        return;
    }
    if (flag === "-p") {
        const content = await fs.readFileSync(path.join(process.cwd(), ".git", "objects", Id.slice(0, 2), Id.slice(2)));
        const dataUnzipped = zlib.inflateSync(content);

        const res = dataUnzipped.toString().split('\0')[1];

        process.stdout.write(res)
    }
}

async function createHashObjectDirectory() {
    const flag = process.argv[3];
    const Id = process.argv[4];
    if (!Id) {
        process.stdout.write(`there is no flag in it`);
        return;
    }

    if (flag !== "-w") {
        return;
    }

    const filepath = path.resolve(Id);

    if (!fs.existsSync(Id)) {
        console.log("File not Found")
        return;
    }

    let content = await fs.readFileSync(Id)
    const size = content.length;

    const header = `blob ${size}\0`;
    const blob = Buffer.concat([Buffer.from(header), content]);

    const hash = crypto.createHash("sha1").update(blob).digest("hex");

    const file = path.join(process.cwd(), ".git", "objects", hash.slice(0, 2))

    if (!fs.existsSync(file)) {
        fs.mkdirSync(file);
    }

    const compressedData = zlib.deflateSync(blob);

    fs.writeFileSync(path.join(file, hash.slice(2)), compressedData);


    process.stdout.write(hash);

}

function createTreeDirectory() {
    const flag = process.argv[3];
    const Id = process.argv[4];

    if (flag === "--name-only" && Id) {
        const filepath = path.join(process.cwd(), ".git", "objects", Id.slice(0, 2), Id.slice(2));

        if (!fs.existsSync(filepath)) {
            console.log("now a valid object name");
            return;
        }
        const content = fs.readFileSync(filepath);
        const uncompressedData = zlib.inflateSync(content)
        let output = uncompressedData.toString().split("\0");

        let treeOutput = output.slice(1).filter(e => e.includes(" "));
        let names = treeOutput.map(e => e.split(" ")[1]);

        names.map((e) => {
            process.stdout.write(e)
            process.stdout.write('\n');
        })
    }
}

function writeTreeCommand() {

    const sha = recursivelyCheck(process.cwd());
    process.stdout.write(sha);
}

function recursivelyCheck(basePath) {
    const dirContents = fs.readdirSync(basePath);
    const result = [];
    for (const dirContent of dirContents) {
        if (dirContent.includes(".git")) continue;

        const currentPath = path.join(basePath, dirContent);
        const stat = fs.statSync(currentPath);

        if (stat.isDirectory()) {
            const sha = recursivelyCheck(currentPath);
            if (sha) {
                result.push({ mode: "40000", basename: path.basename(currentPath), sha })
            }
        } else if (stat.isFile()) {
            const sha = writeBlob(currentPath);
            result.push({ mode: "100644", basename: path.basename(currentPath), sha })
        }
    }

    // console.log(result)

    if (dirContents.length === 0 || result.length === 0) return null;

    const treeContent = result.reduce((acc, current) => {
        const { mode, basename, sha } = current;
        return Buffer.concat([acc, Buffer.from(`${mode} ${basename}\0`), Buffer.from(sha, "hex"),])
    }, Buffer.alloc(0))

    const tree = Buffer.concat([
        Buffer.from(`tree ${treeContent.length}\0`),
        treeContent,
    ])

    const hash = crypto.createHash("sha1").update(tree).digest("hex");

    // console.log(hash)

    const file = path.join(process.cwd(), ".git", "objects", hash.slice(0, 2))

    if (!fs.existsSync(file)) {
        fs.mkdirSync(file);
    }

    const compressedData = zlib.deflateSync(tree);

    fs.writeFileSync(path.join(file, hash.slice(2)), compressedData);

    return hash;
}

function writeBlob(currentPath) {

    let content = fs.readFileSync(currentPath)
    const size = content.length;

    const header = `blob ${size}\0`;
    const blob = Buffer.concat([Buffer.from(header), content]);

    const hash = crypto.createHash("sha1").update(blob).digest("hex");
    const file = path.join(process.cwd(), ".git", "objects", hash.slice(0, 2))

    if (!fs.existsSync(file)) {
        fs.mkdirSync(file);
    }

    const compressedData = zlib.deflateSync(blob);

    fs.writeFileSync(path.join(file, hash.slice(2)), compressedData);

    return hash;
}

function commitTreeCommand() {
    const sha = process.argv[3];
    const commitsha = process.argv[5];
    const commitMessage = process.argv[7];

    const commitBuffer = Buffer.concat([
        Buffer.from(`tree ${sha}\n`),
        Buffer.from(`parent ${commitsha}\n`),
        Buffer.from(`author Anuj Pandey <anujsde@gmail.com> ${Date.now()} +0000\n`),
        Buffer.from(`committer Anuj Pandey <anujsde@gmail.com> ${Date.now()} +0000\n\n`),
        Buffer.from(`${commitMessage}\n`),
    ])

    const header = `commit ${commitBuffer.length}\0`;
    const data = Buffer.concat([Buffer.from(header), commitBuffer]);

    const hash = crypto.createHash("sha1").update(data).digest("hex");

    const file = path.join(process.cwd(), ".git", "objects", hash.slice(0, 2))

    if (!fs.existsSync(file)) {
        fs.mkdirSync(file);
    }

    const compressedData = zlib.deflateSync(data);

    fs.writeFileSync(path.join(file, hash.slice(2)), compressedData);

    process.stdout.write(hash);
}