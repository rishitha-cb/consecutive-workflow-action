const core = require('@actions/core')
const github = require('@actions/github')

function sleep(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function run() {
  try {
    const token = core.getInput('token')
    const interval = core.getInput('interval')
    const octokit = github.getOctokit(token)

    const owner = github.context.payload.repository.owner.login
    const repo = github.context.payload.repository.name

    // get current run (to know the workflow_id)
    let { data: currentRun } = await octokit.rest.actions.getWorkflowRun({
      owner,
      repo,
      run_id: github.context.runId,
    })

    // fetch the latest workflow runs and find the last one before the currently running one
    const { data: { workflow_runs: runs } } = await octokit.rest.actions.listWorkflowRuns({ owner, repo, workflow_id: currentRun.workflow_id })
    // to take into account that runs can be deleted: sort runs by number and pick the first with a number smaller than the current one
    let lastRun = runs.sort((a, b) => b.run_number - a.run_number).find(run => run.run_number < currentRun.run_number)

    // re-check in intervals, as long as it has not completed
    if (lastRun) {
      while (lastRun.status !== 'completed') {
        core.info(`Last run (${lastRun.id}) not completed yet. Waiting for ${interval} seconds.`)
        await sleep(interval)
        let { data: updatedRun } = await octokit.rest.actions.getWorkflowRun({
          owner,
          repo,
          run_id: lastRun.id,
        })
        lastRun = updatedRun
      }
      core.info(`Last run (${lastRun.id}) has completed.`)
    } else {
      core.info(`This is the first time this workflow runs. No checks needed.`)
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
