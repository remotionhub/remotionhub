import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import YAML from 'yaml'

type WorkflowStep = {
  name?: string
  if?: string
  run?: string
  env?: Record<string, string>
  uses?: string
}

type WorkflowJob = {
  needs?: string | string[]
  if?: string
  env?: Record<string, string>
  steps: WorkflowStep[]
}

type DeployWorkflow = {
  on: {
    workflow_dispatch: {
      inputs: {
        target: {
          default: string
          options: string[]
        }
        dry_run: {
          default: boolean
        }
      }
    }
  }
  concurrency: {
    group: string
    'cancel-in-progress': boolean
  }
  jobs: Record<string, WorkflowJob>
}

const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8')
const parsed = YAML.parse(workflow) as DeployWorkflow
const jobs = parsed.jobs

function getStep(jobName: string, stepName: string) {
  const step = jobs[jobName].steps.find((candidate) => candidate.name === stepName)
  expect(step).toBeDefined()
  return step as WorkflowStep
}

function expectNoJobScopedDeploySecrets(jobName: string) {
  expect(jobs[jobName].env ?? {}).not.toHaveProperty('CONVEX_DEPLOY_KEY')
  expect(jobs[jobName].env ?? {}).not.toHaveProperty('CLOUDFLARE_API_TOKEN')
  expect(jobs[jobName].env ?? {}).not.toHaveProperty('CLOUDFLARE_ACCOUNT_ID')
}

describe('deploy workflow', () => {
  test('is manually triggered with conservative defaults', () => {
    expect(Object.keys(parsed.on)).toEqual(['workflow_dispatch'])
    expect(workflow).not.toContain('push:')
    expect(parsed.on.workflow_dispatch.inputs.target.default).toBe('full')
    expect(parsed.on.workflow_dispatch.inputs.target.options).toEqual([
      'full',
      'backend',
      'frontend',
      'smoke',
    ])
    expect(parsed.on.workflow_dispatch.inputs.dry_run.default).toBe(true)
    expect(parsed.concurrency.group).toBe('production-deploy')
    expect(parsed.concurrency['cancel-in-progress']).toBe(false)
    expect(getStep('preflight', 'Validate release configuration').run).toContain(
      'refs/heads/main',
    )
  })

  test('limits deploy secrets to validation and deploy steps', () => {
    Object.keys(jobs).forEach(expectNoJobScopedDeploySecrets)

    expect(getStep('preflight', 'Validate release configuration').env).toMatchObject({
      CONVEX_DEPLOY_KEY: '${{ secrets.CONVEX_DEPLOY_KEY }}',
      CLOUDFLARE_API_TOKEN: '${{ secrets.CLOUDFLARE_API_TOKEN }}',
      CLOUDFLARE_ACCOUNT_ID: '${{ secrets.CLOUDFLARE_ACCOUNT_ID }}',
    })
    expect(getStep('backend_deploy', 'Dry-run Convex deploy').env).toMatchObject({
      CONVEX_DEPLOY_KEY: '${{ secrets.CONVEX_DEPLOY_KEY }}',
    })
    expect(getStep('backend_deploy', 'Deploy Convex backend').env).toMatchObject({
      CONVEX_DEPLOY_KEY: '${{ secrets.CONVEX_DEPLOY_KEY }}',
    })
    expect(getStep('frontend_deploy', 'Build Cloudflare frontend').env).toBeUndefined()
    expect(getStep('frontend_deploy', 'Dry-run Cloudflare deploy').env).toMatchObject({
      CLOUDFLARE_API_TOKEN: '${{ secrets.CLOUDFLARE_API_TOKEN }}',
      CLOUDFLARE_ACCOUNT_ID: '${{ secrets.CLOUDFLARE_ACCOUNT_ID }}',
    })
    expect(getStep('frontend_deploy', 'Deploy Cloudflare frontend').env).toMatchObject({
      CLOUDFLARE_API_TOKEN: '${{ secrets.CLOUDFLARE_API_TOKEN }}',
      CLOUDFLARE_ACCOUNT_ID: '${{ secrets.CLOUDFLARE_ACCOUNT_ID }}',
    })
    expect(workflow).not.toContain('${{ vars.CLOUDFLARE_ACCOUNT_ID }}')
  })

  test('keeps deploy orchestration explicit', () => {
    expect(jobs.backend_deploy.if).toContain("inputs.target == 'backend'")
    expect(jobs.backend_deploy.if).toContain("inputs.target == 'full'")
    expect(getStep('backend_deploy', 'Dry-run Convex deploy').if).toBe(
      '${{ inputs.dry_run }}',
    )
    expect(getStep('backend_deploy', 'Deploy Convex backend').if).toBe(
      '${{ !inputs.dry_run }}',
    )

    expect(jobs.frontend_deploy.needs).toEqual(['preflight', 'backend_deploy'])
    expect(jobs.frontend_deploy.if).toContain("inputs.target == 'frontend'")
    expect(jobs.frontend_deploy.if).toContain("inputs.target == 'full'")
    expect(getStep('frontend_deploy', 'Build Cloudflare frontend').run).toBe(
      'npm run build',
    )
    expect(getStep('frontend_deploy', 'Dry-run Cloudflare deploy').if).toBe(
      '${{ inputs.dry_run }}',
    )
    expect(getStep('frontend_deploy', 'Deploy Cloudflare frontend').if).toBe(
      '${{ !inputs.dry_run }}',
    )

    expect(jobs.production_smoke.if).toContain("inputs.target == 'smoke'")
    expect(jobs.production_smoke.if).toContain(
      "inputs.target == 'full' && !inputs.dry_run",
    )
  })
})
