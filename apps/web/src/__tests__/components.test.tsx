import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatusBadge } from '../components/app/kit'
import { MatchCard } from '../components/app/MatchCard'
import { DecisionCard } from '../components/app/DataRequestResult'
import type { MatchCandidate } from '../lib/types'

describe('StatusBadge', () => {
  it('uses plain-language labels for decisions', () => {
    render(<><StatusBadge status="allow" /><StatusBadge status="deny" /><StatusBadge status="not_anchored" /></>)
    expect(screen.getByText('Allowed')).toBeInTheDocument()
    expect(screen.getByText('Denied')).toBeInTheDocument()
    expect(screen.getByText('Not anchored')).toBeInTheDocument()
  })
  it('never shows a verified state for an unknown status', () => {
    render(<StatusBadge status={null} />)
    expect(screen.queryByText(/verified/i)).toBeNull()
  })
})

const rec = (org: string, id: string, mrn: string) => ({ organization_id: org, organization_name: org, patient_id: id, mrn, name: 'Ananya Krishnan', birth_date: '1981-06-17', gender: 'female', city: 'Pune', phone: '555' })
const candidate: MatchCandidate = {
  a: rec('MetroCare', 'a', 'MC-1'),
  b: rec('Sunrise', 'b', 'SG-1'),
  score: 0.95,
  confidence: 'high',
  explanation: [{ field: 'Date of birth', result: 'match', weight: 0.3, note: 'Identical' }],
  link_id: null,
  link_status: null,
}

describe('MatchCard', () => {
  it('explains the score and lets a reviewer decide', () => {
    let decided = ''
    render(<MatchCard c={candidate} onDecide={(d) => (decided = d)} />)
    expect(screen.getByText('95')).toBeInTheDocument()
    expect(screen.getByText('Date of birth')).toBeInTheDocument()
    expect(screen.getByText('MC-1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Confirm match/ }))
    expect(decided).toBe('confirm')
  })
  it('hides review actions when reviewing is not allowed', () => {
    render(<MatchCard c={candidate} canReview={false} onDecide={() => {}} />)
    expect(screen.queryByRole('button', { name: /Confirm match/ })).toBeNull()
  })
})

describe('DecisionCard', () => {
  it('shows allowed and denied resources with reasons', () => {
    render(
      <DecisionCard
        d={{ organization_id: 'o', organization_name: 'Sunrise General Hospital', outcome: 'allow', allowed_resource_types: ['Observation'], denied_resource_types: ['MedicationRequest'], reasons: ['MedicationRequest is outside the approved scope'], policy_results: [], audit_event_id: 'e' }}
      />,
    )
    expect(screen.getByText('Partially allowed')).toBeInTheDocument()
    expect(screen.getByText('MedicationRequest')).toBeInTheDocument()
    expect(screen.getByText(/outside the approved scope/)).toBeInTheDocument()
  })
})
