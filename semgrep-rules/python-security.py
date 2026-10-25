import hashlib
import os
import sqlite3
import subprocess

from flask import render_template_string, request

db = sqlite3.connect(":memory:")


def sql_bad():
    name = request.args.get("name", "")
    # ruleid: fixitry-sql-injection
    db.execute(f"SELECT * FROM users WHERE name = '{name}'")


def sql_ok():
    name = request.args.get("name", "")
    # ok: fixitry-sql-injection
    db.execute("SELECT * FROM users WHERE name = ?", (name,))


def path_bad():
    filename = request.args.get("file", "")
    # ruleid: fixitry-path-traversal
    open(os.path.join("notes", filename))


def path_ok():
    # ok: fixitry-path-traversal
    open(os.path.join("notes", "welcome.txt"))


def path_sanitized_ok():
    filename = request.args.get("file", "")
    # ok: fixitry-path-traversal
    open(os.path.join("notes", os.path.basename(filename)))


def template_bad():
    name = request.args.get("name", "")
    # ruleid: fixitry-template-injection
    return render_template_string("<h1>Hello " + name + "</h1>")


def template_ok():
    name = request.args.get("name", "")
    # ok: fixitry-template-injection
    return render_template_string("<h1>Hello {{ name }}</h1>", name=name)


def hash_bad():
    # ruleid: fixitry-weak-hash
    return hashlib.md5(b"x").hexdigest()


def hash_ok():
    # ok: fixitry-weak-hash
    return hashlib.sha256(b"x").hexdigest()


def shell_bad(cmd):
    # ruleid: fixitry-shell-true
    subprocess.run(cmd, shell=True)


def shell_ok(cmd):
    # ok: fixitry-shell-true
    subprocess.run(["echo", cmd])
