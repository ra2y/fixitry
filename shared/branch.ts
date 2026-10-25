const BRANCH_RE = /^fixitry\/fix-[A-Za-z0-9]+$/;

export function branchNameForJob(jobId: string): string {
  const suffix = jobId.replace(/[^A-Za-z0-9]/g, "").slice(-12);
  if (!suffix) throw new Error("Cannot derive a branch name from this job ID");
  return `fixitry/fix-${suffix}`;
}

export function assertGeneratedBranchName(branch: string): void {
  if (!BRANCH_RE.test(branch)) {
    throw new Error("Refusing to push a non-generated Fixitry branch");
  }
}
