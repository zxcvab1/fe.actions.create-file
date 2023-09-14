import * as core from '@actions/core'
import fsAsync from 'fs/promises'
import fs from 'fs'
import path from 'path'
import * as github from '@actions/github'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const inputFile: string = core.getInput('file')
    const inputOwner: string = core.getInput('owner')
    const inputRepo: string = core.getInput('repo')
    const inputToken: string = core.getInput('token')
    const inputMessage: string = core.getInput('message')
    const inputPath: string = core.getInput('path')
    const inputBranch: string = core.getInput('branch')

    const filePath = path.join(process.cwd(), inputFile)
    const repo = inputRepo || github.context.repo.repo
    const owner = inputOwner || github.context.repo.owner

    const octokit = github.getOctokit(inputToken)

    // Debug logs are only output if the `ACTIONS_STEP_DEBUG` secret is true
    core.debug(`${filePath}`)

    // Checking file path is exist.
    if (!fs.existsSync(filePath)) {
      throw new Error(`Path not found: ${filePath}`)
    }
    // Check inputBranch if it doesn't exist then create new branch
    if (inputBranch) {
      try {
        await octokit.rest.repos.getBranch({
          branch: inputBranch,
          owner,
          repo
        })
      } catch (error) {
        core.info(
          `Not found ${inputBranch} branch. Creating new branch [${inputBranch}]`
        )

        // Get repo info information to get default branch
        const getRepoInfo = await octokit.rest.repos.get({
          owner,
          repo
        })
        const refDefaultBranch = getRepoInfo.data.default_branch

        // Get default branch information to get branch SHA
        const getBranchRefInfo = await octokit.rest.repos.getBranch({
          owner,
          repo,
          branch: refDefaultBranch
        })
        const refSHA = getBranchRefInfo.data.commit.sha

        core.info(
          JSON.stringify({
            owner,
            repo,
            ref: `refs/heads/${inputBranch}`,
            sha: refSHA
          })
        )
        // create new branch
        await octokit.rest.git.createRef({
          owner,
          repo,
          ref: `refs/heads/${inputBranch}`,
          sha: refSHA
        })

        core.info(
          `Create branch ${inputBranch} from ${refDefaultBranch} ${refSHA} successfull.`
        )
      }
    }
    const fileContent = await fsAsync.readFile(filePath, { encoding: 'base64' })

    try {
      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        message: inputMessage,
        content: fileContent,
        path: inputPath,
        branch: inputBranch
      })
    } catch (error) {
      const existedFileDir = path.dirname(inputPath)
      const existedFileName = path.basename(inputPath)
      const existedFileURL = `https://github.com/${owner}/${repo}/tree/${inputBranch}/${existedFileDir}`
      throw new Error(
        `Create existed file [${existedFileName}]. ${existedFileURL}`
      )
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
run()
