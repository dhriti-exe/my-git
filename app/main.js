const fs = require("fs")
const path = require("path");
const zlib = require("zlib")

console.error("Logs from your program will appear here!");

const command = process.argv[2];

switch (command) {
    case "init":
        createGitDirectory();
        break;
    case "cat-file":
        createCatFileDirectory();
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