import test from 'node:test'
import assert from 'node:assert/strict'
import { buildApplicantEmailDraft } from '../../resources/js/react/utils/applicantEmail.js'

test('application drafts preserve recipients, sender, position, and encoding in both email clients', () => {
  const draft = buildApplicantEmailDraft({ email: 'applicant@example.com', name: 'Maria Cruz', appliedJobTitle: 'Arts & Sciences Instructor I' }, 'personnel@example.com')
  const gmail = new URL(draft.gmail)
  const mailto = new URL(draft.mailto)
  assert.equal(gmail.searchParams.get('to'), draft.email)
  assert.equal(gmail.searchParams.get('authuser'), 'personnel@example.com')
  assert.equal(gmail.searchParams.get('su'), mailto.searchParams.get('subject'))
  assert.equal(gmail.searchParams.get('body'), mailto.searchParams.get('body'))
  assert.match(gmail.searchParams.get('body'), /^Dear Maria Cruz,\n\n/)
  assert.ok(gmail.searchParams.get('body').includes('Arts & Sciences Instructor I'))
})

test('missing names and positions receive a formal fallback without placeholder titles', () => {
  const draft = buildApplicantEmailDraft({ email: 'applicant@example.com', applied_job_title: 'No position selected' })
  const body = new URL(draft.gmail).searchParams.get('body')
  assert.match(body, /^Dear Applicant,/)
  assert.ok(!body.includes('No position selected'))
  assert.equal(buildApplicantEmailDraft({}), null)
})
