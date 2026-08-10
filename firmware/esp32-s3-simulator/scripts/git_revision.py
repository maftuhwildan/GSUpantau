Import("env")

import subprocess


def read_git_revision():
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short=12", "HEAD"],
            cwd=env.subst("$PROJECT_DIR"),
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


env.Append(CPPDEFINES=[("FIRMWARE_GIT_REV", env.StringifyMacro(read_git_revision()))])
