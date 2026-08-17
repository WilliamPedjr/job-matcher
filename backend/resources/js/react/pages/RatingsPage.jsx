import React, { useEffect, useMemo, useRef, useState } from 'react'
import '../styles/RatingsPage.css'
import ApplicantViewPage from './ApplicantViewPage'
import CustomDropdown from '../components/CustomDropdown'
import { getArchiveActorHeaders } from '../utils/archiveActor'

function formatInterviewDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

function getPosition(item) {
  return item.applied_job_title || item.appliedJobTitle || item.matched_job_title || 'No position selected'
}

function getEvaluationStatus(item) {
  return String(item?.evaluation_status || item?.evaluationStatus || '').toLowerCase()
}

function getEvaluationStatusLabel(item) {
  return getEvaluationStatus(item) === 'rated' ? 'Rated' : 'For Evaluation'
}

const defaultRatingCriteria = [
  'Appearance and Grooming',
  'Technical Knowledge and Mastery',
  'Confidence and Composure',
  'Job Knowledge and Competence',
  'Critical Thinking and Problem Solving',
  'Attitude and Professionalism',
  'Interpersonal Skills',
  'Adaptability and Flexibility',
  'Motivation and Interest in the Position',
  'Overall Interview Performance'
]

const ratingCriteriaStorageKey = 'ratingsCriteria'
const boardMembersStorageKey = 'ratingsBoardMembers'

function loadRatingCriteria() {
  if (typeof window === 'undefined') return defaultRatingCriteria
  try {
    const stored = window.localStorage.getItem(ratingCriteriaStorageKey)
    const parsed = stored ? JSON.parse(stored) : null
    if (Array.isArray(parsed) && parsed.length === defaultRatingCriteria.length) {
      const cleaned = parsed.map((item) => String(item || '').trim())
      if (cleaned.every(Boolean)) return cleaned
    }
  } catch {
    // Use defaults when local storage is unavailable or invalid.
  }
  return defaultRatingCriteria
}

const ratingBands = [
  { label: 'Outstanding', range: '41 - 50', value: 5 },
  { label: 'Very Satisfactory', range: '31 - 40', value: 4 },
  { label: 'Satisfactory', range: '21 - 30', value: 3 },
  { label: 'Below Satisfactory', range: '11 - 20', value: 2 },
  { label: 'Unsatisfactory', range: '10 & below', value: 1 }
]

const defaultBoardMembers = [
  'Dr. Solomon Faller Jr.',
  'Jasmin Graeles',
  'Prof. Drake Ortega Jr.',
  'Josisor Conchada',
  'Prof. Jose Ismael Galamia',
  'Dr. Joyce Magtolis',
  'Cesar Blanco'
]

function loadBoardMembers() {
  if (typeof window === 'undefined') return defaultBoardMembers
  try {
    const stored = window.localStorage.getItem(boardMembersStorageKey)
    const parsed = stored ? JSON.parse(stored) : null
    if (Array.isArray(parsed)) {
      const cleaned = parsed.map((item) => String(item || '').trim()).filter(Boolean)
      if (cleaned.length > 0) return Array.from(new Set(cleaned))
    }
  } catch {
    // Use defaults when local storage is unavailable or invalid.
  }
  return defaultBoardMembers
}

function RatingsPage({ uploads = [], isLoading = false, currentUser = null, onRatingsChanged }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [positionFilter, setPositionFilter] = useState('all')
  const [criteriaEditorOpen, setCriteriaEditorOpen] = useState(false)
  const [ratingCriteria, setRatingCriteria] = useState(loadRatingCriteria)
  const [criteriaDraft, setCriteriaDraft] = useState(() => loadRatingCriteria())
  const [boardMembers, setBoardMembers] = useState(loadBoardMembers)
  const [boardMembersDraft, setBoardMembersDraft] = useState(() => loadBoardMembers())
  const [newBoardMemberName, setNewBoardMemberName] = useState('')
  const [selectedApplicant, setSelectedApplicant] = useState(null)
  const [ratingStarted, setRatingStarted] = useState(false)
  const [ratingScores, setRatingScores] = useState({})
  const [ratingRemarks, setRatingRemarks] = useState('')
  const [actionsMenu, setActionsMenu] = useState(null)
  const [confirmRatingAction, setConfirmRatingAction] = useState(null)
  const [confirmSaveRating, setConfirmSaveRating] = useState(false)
  const [cancelledIds, setCancelledIds] = useState([])
  const [ratingNotice, setRatingNotice] = useState(null)
  const [selectedBoardMember, setSelectedBoardMember] = useState('')
  const ratingNoticeTimer = useRef(null)

  const evaluationUploads = useMemo(() => (
    uploads.filter((item) => ['for_evaluation', 'rated'].includes(getEvaluationStatus(item)))
  ), [uploads])

  const positionOptions = useMemo(() => {
    const titles = Array.from(
      new Set(
        evaluationUploads
          .map((item) => getPosition(item))
          .filter((title) => title && title !== 'No position selected')
      )
    ).sort((a, b) => a.localeCompare(b))

    return [
      { value: 'all', label: 'All Positions' },
      ...titles.map((title) => ({ value: title, label: title }))
    ]
  }, [evaluationUploads])

  const filteredUploads = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return evaluationUploads.filter((item) => {
      if (cancelledIds.includes(item.id)) return false
      const position = getPosition(item)
      const matchesPosition = positionFilter === 'all' || position === positionFilter
      if (!matchesPosition) return false
      if (!query) return true

      const haystack = [
        item.name,
        item.email,
        item.phone,
        position
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [cancelledIds, evaluationUploads, positionFilter, searchTerm])

  useEffect(() => {
    if (!actionsMenu) return
    const handleClose = () => setActionsMenu(null)
    window.addEventListener('click', handleClose)
    window.addEventListener('resize', handleClose)
    window.addEventListener('scroll', handleClose, true)
    return () => {
      window.removeEventListener('click', handleClose)
      window.removeEventListener('resize', handleClose)
      window.removeEventListener('scroll', handleClose, true)
    }
  }, [actionsMenu])

  useEffect(() => () => {
    if (ratingNoticeTimer.current) {
      window.clearTimeout(ratingNoticeTimer.current)
    }
  }, [])

  const showRatingNotice = (type, message) => {
    if (ratingNoticeTimer.current) {
      window.clearTimeout(ratingNoticeTimer.current)
    }
    setRatingNotice({ type, message })
    ratingNoticeTimer.current = window.setTimeout(() => {
      setRatingNotice(null)
      ratingNoticeTimer.current = null
    }, 2800)
  }

  const openCriteriaEditor = () => {
    setCriteriaDraft(ratingCriteria)
    setBoardMembersDraft(boardMembers)
    setNewBoardMemberName('')
    setCriteriaEditorOpen(true)
  }

  const saveCriteriaDraft = async () => {
    const cleaned = criteriaDraft.map((item) => String(item || '').trim())
    if (cleaned.some((item) => !item)) {
      showRatingNotice('fail', 'Please complete all rating criteria.')
      return
    }
    const uniqueCount = new Set(cleaned.map((item) => item.toLowerCase())).size
    if (uniqueCount !== cleaned.length) {
      showRatingNotice('fail', 'Criteria names must be unique.')
      return
    }
    const cleanedBoardMembers = boardMembersDraft.map((item) => String(item || '').trim()).filter(Boolean)
    if (cleanedBoardMembers.length === 0) {
      showRatingNotice('fail', 'Please add at least one board member.')
      return
    }
    const uniqueBoardMembers = Array.from(new Set(cleanedBoardMembers.map((item) => item.toLowerCase())))
    if (uniqueBoardMembers.length !== cleanedBoardMembers.length) {
      showRatingNotice('fail', 'Board member names must be unique.')
      return
    }
    setRatingCriteria(cleaned)
    setBoardMembers(cleanedBoardMembers)
    window.localStorage.setItem(ratingCriteriaStorageKey, JSON.stringify(cleaned))
    window.localStorage.setItem(boardMembersStorageKey, JSON.stringify(cleanedBoardMembers))
    try {
      await fetch('http://localhost:5000/activity-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getArchiveActorHeaders(currentUser)
        },
        body: JSON.stringify({
          event: 'rating.settings_updated',
          description: 'Edited rating form settings.',
          subjectType: 'rating_settings',
          subjectName: 'Rating form',
          metadata: {
            before: {
              criteria: ratingCriteria,
              boardMembers
            },
            after: {
              criteria: cleaned,
              boardMembers: cleanedBoardMembers
            },
            criteriaCount: cleaned.length,
            boardMemberCount: cleanedBoardMembers.length
          }
        })
      })
      await onRatingsChanged?.()
    } catch {
      // Keep local settings saved even if activity logging is temporarily unavailable.
    }
    setCriteriaEditorOpen(false)
    showRatingNotice('success', 'Rating settings updated successfully.')
  }

  const resetCriteriaDraft = () => {
    setCriteriaDraft(defaultRatingCriteria)
    setBoardMembersDraft(defaultBoardMembers)
    setNewBoardMemberName('')
  }

  const addBoardMemberDraft = () => {
    const name = newBoardMemberName.trim()
    if (!name) return
    if (boardMembersDraft.some((member) => member.toLowerCase() === name.toLowerCase())) {
      showRatingNotice('fail', 'Board member already exists.')
      return
    }
    setBoardMembersDraft((prev) => [...prev, name])
    setNewBoardMemberName('')
  }

  const openActionsMenu = (event, item) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setActionsMenu({
      item,
      top: rect.bottom + 6,
      left: Math.max(12, rect.right - 150)
    })
  }

  const totalRatingScore = useMemo(() => (
    ratingCriteria.reduce((total, criterion) => total + Number(ratingScores[criterion] || 0), 0)
  ), [ratingScores])

  const saveRating = async () => {
    if (!selectedApplicant?.id) return
    if (!selectedBoardMember) {
      showRatingNotice('fail', 'Please select a board member before saving.')
      return
    }
    if (hasBoardMemberRated(selectedApplicant, selectedBoardMember)) {
      showRatingNotice('fail', `${selectedBoardMember} has already rated this applicant.`)
      return
    }
    const missingScore = ratingCriteria.some((criterion) => !ratingScores[criterion])
    if (missingScore) {
      showRatingNotice('fail', 'Please complete all rating criteria before saving.')
      return
    }

    const scores = ratingCriteria.reduce((payload, criterion) => ({
      ...payload,
      [criterion]: Number(ratingScores[criterion])
    }), {})

    try {
      const response = await fetch(`http://localhost:5000/uploads/${selectedApplicant.id}/ratings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getArchiveActorHeaders(currentUser)
        },
        body: JSON.stringify({
          raterName: selectedBoardMember,
          raterEmail: '',
          boardMembers,
          scores,
          remarks: ratingRemarks.trim()
        })
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to save rating.')
      }
      setSelectedApplicant(payload)
      setRatingScores({})
      setRatingRemarks('')
      setSelectedBoardMember('')
      setRatingStarted(false)
      onRatingsChanged?.()
      showRatingNotice('success', 'Rating saved successfully.')
    } catch (error) {
      showRatingNotice('fail', error.message || 'Failed to save rating.')
    }
  }

  const requestSaveRating = () => {
    if (!selectedBoardMember) {
      showRatingNotice('fail', 'Please select a board member before saving.')
      return
    }
    if (hasBoardMemberRated(selectedApplicant, selectedBoardMember)) {
      showRatingNotice('fail', `${selectedBoardMember} has already rated this applicant.`)
      return
    }
    const missingScore = ratingCriteria.some((criterion) => !ratingScores[criterion])
    if (missingScore) {
      showRatingNotice('fail', 'Please complete all rating criteria before saving.')
      return
    }

    setConfirmSaveRating(true)
  }

  const cancelRating = async (item) => {
    if (!item?.id) return
    setActionsMenu(null)
    try {
      const response = await fetch(`http://localhost:5000/uploads/${item.id}/evaluation/cancel`, {
        method: 'PUT',
        headers: getArchiveActorHeaders(currentUser)
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to cancel rating.')
      }
      setCancelledIds((prev) => Array.from(new Set([...prev, item.id])))
      if (selectedApplicant?.id === item.id) {
        setSelectedApplicant(null)
        setRatingStarted(false)
        setRatingScores({})
        setRatingRemarks('')
        setSelectedBoardMember('')
      }
      onRatingsChanged?.()
      showRatingNotice(
        'success',
        isRatedApplicant(item) ? 'Rating record deleted successfully.' : 'Interview rating cancelled successfully.'
      )
    } catch (error) {
      showRatingNotice('fail', error.message || 'Failed to cancel rating.')
    }
  }

  const exportRatingSummary = async (item) => {
    if (!item?.id) return
    setActionsMenu(null)
    try {
      const response = await fetch(`http://localhost:5000/uploads/${item.id}/rating-summary/export`, {
        headers: getArchiveActorHeaders(currentUser)
      })
      const blob = await response.blob()
      if (!response.ok) {
        const message = await blob.text().then((text) => {
          try {
            return JSON.parse(text)?.message
          } catch {
            return null
          }
        }).catch(() => null)
        throw new Error(message || 'Failed to export rating summary.')
      }

      const disposition = response.headers.get('content-disposition') || ''
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/i)
      const filename = filenameMatch?.[1] || `rating-summary-${item.id}.xls`
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      await onRatingsChanged?.()
      showRatingNotice('success', 'Rating summary exported successfully.')
    } catch (error) {
      showRatingNotice('fail', error.message || 'Failed to export rating summary.')
    }
  }

  const openCancelConfirmation = (item) => {
    if (!item?.id) return
    setActionsMenu(null)
    setConfirmRatingAction(item)
  }

  const closeCancelConfirmation = () => {
    setConfirmRatingAction(null)
  }

  const closeSaveConfirmation = () => {
    setConfirmSaveRating(false)
  }

  const isRatedApplicant = (item) => Boolean(item?.ratingCount || item?.rating_count || (Array.isArray(item?.ratings) && item.ratings.length))
  const hasBoardMemberRated = (item, boardMember) => {
    const ratings = Array.isArray(item?.ratings) ? item.ratings : []
    const boardMemberName = String(boardMember || '').trim().toLowerCase()

    return Boolean(boardMemberName) && ratings.some((rating) => {
      const raterName = String(rating.raterName || rating.rater_name || '').trim().toLowerCase()
      return raterName === boardMemberName
    })
  }

  const ratingNoticeNode = ratingNotice ? (
    <div className={`toast toast-${ratingNotice.type}`} role="status" aria-live="polite">
      {ratingNotice.message}
    </div>
  ) : null

  const confirmationIsDelete = isRatedApplicant(confirmRatingAction)
  const ratingConfirmNode = confirmRatingAction ? (
    <div
      className="modal-overlay delete-confirm-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeCancelConfirmation()
        }
      }}
    >
      <div className="modal-card delete-confirm-card">
        <h3>{confirmationIsDelete ? 'Delete Rating' : 'Cancel Interview'}</h3>
        <p>
          {confirmationIsDelete
            ? `Are you sure you want to delete the rating record for ${confirmRatingAction.name || 'this applicant'}?`
            : `Are you sure you want to cancel the interview rating for ${confirmRatingAction.name || 'this applicant'}?`}
        </p>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={closeCancelConfirmation}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={async () => {
              const target = confirmRatingAction
              closeCancelConfirmation()
              await cancelRating(target)
            }}
          >
            {confirmationIsDelete ? 'Delete' : 'Cancel Interview'}
          </button>
        </div>
      </div>
    </div>
  ) : null

  if (criteriaEditorOpen) {
    return (
      <section className="ratings-criteria-page" aria-label="Edit rating criteria">
        {ratingNoticeNode}
        <div className="ratings-form-header">
          <div>
            <button
              type="button"
              className="ratings-back-link"
              onClick={() => setCriteriaEditorOpen(false)}
            >
              Back to Ratings
            </button>
            <h2>Edit Rating Settings</h2>
            <p>Update the criteria and board members used in the interview rating form.</p>
          </div>
        </div>

        <div className="ratings-criteria-card">
          <div className="ratings-settings-section-head">
            <h3>Rating Criteria</h3>
            <span>{criteriaDraft.length} items</span>
          </div>
          {criteriaDraft.map((criterion, index) => (
            <label key={`criteria-${index}`} className="ratings-criteria-field">
              <span>Criteria {index + 1}</span>
              <input
                type="text"
                value={criterion}
                onChange={(event) => {
                  const next = [...criteriaDraft]
                  next[index] = event.target.value
                  setCriteriaDraft(next)
                }}
              />
            </label>
          ))}
        </div>

        <div className="ratings-criteria-card">
          <div className="ratings-settings-section-head">
            <h3>Board Members</h3>
            <span>{boardMembersDraft.length} members</span>
          </div>
          <div className="ratings-board-editor-add">
            <input
              type="text"
              value={newBoardMemberName}
              placeholder="Board member name"
              onChange={(event) => setNewBoardMemberName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addBoardMemberDraft()
                }
              }}
            />
            <button type="button" className="btn" onClick={addBoardMemberDraft}>
              Add
            </button>
          </div>
          <div className="ratings-board-editor-list">
            {boardMembersDraft.map((member, index) => (
              <div key={`${member}-${index}`} className="ratings-board-editor-row">
                <span>{member}</span>
                <button
                  type="button"
                  className="ratings-board-delete-btn"
                  onClick={() => {
                    setBoardMembersDraft((prev) => prev.filter((_, memberIndex) => memberIndex !== index))
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="ratings-form-footer">
          <button type="button" className="btn btn-secondary" onClick={resetCriteriaDraft}>
            Reset Defaults
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setCriteriaEditorOpen(false)}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={saveCriteriaDraft}>
            Save Settings
          </button>
        </div>
      </section>
    )
  }

  if (selectedApplicant) {
    const applicantRatings = Array.isArray(selectedApplicant.ratings) ? selectedApplicant.ratings : []
    const ratingLabel = selectedApplicant.ratingLabel || selectedApplicant.rating_label || 'No rating'
    const ratingCount = Number(selectedApplicant.ratingCount || selectedApplicant.rating_count || applicantRatings.length || 0)
    const canOpenRatingForm = ratingStarted
    const interviewDate = formatInterviewDate(selectedApplicant.uploaded_at || selectedApplicant.updated_at || selectedApplicant.updatedAt)
    const selectedBoardMemberAlreadyRated = hasBoardMemberRated(selectedApplicant, selectedBoardMember)
    const saveRatingConfirmNode = confirmSaveRating ? (
      <div
        className="modal-overlay delete-confirm-overlay"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeSaveConfirmation()
          }
        }}
      >
        <div className="modal-card delete-confirm-card ratings-save-confirm-card">
          <h3>Save Rating</h3>
          <p>
            Save {selectedBoardMember || 'this board member'}'s rating for {selectedApplicant.name || 'this applicant'}?
          </p>
          <div className="ratings-save-confirm-summary">
            <span>Board Member</span>
            <strong>{selectedBoardMember || '-'}</strong>
            <span>Total Score</span>
            <strong>{totalRatingScore}/50</strong>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={closeSaveConfirmation}>
              Cancel
            </button>
            <button
              type="button"
              className="btn"
              onClick={async () => {
                closeSaveConfirmation()
                await saveRating()
              }}
            >
              Confirm Save
            </button>
          </div>
        </div>
      </div>
    ) : null

    if (canOpenRatingForm) {
      return (
        <section className="ratings-form-page" aria-label="Interview rating form">
          {ratingNoticeNode}
          {saveRatingConfirmNode}
          <div className="ratings-form-header">
            <div>
              <button
                type="button"
                className="ratings-back-link"
                onClick={() => {
          setSelectedBoardMember('')
          setRatingRemarks('')
          setRatingStarted(false)
                }}
              >
                Back to Applicant Summary
              </button>
              <h2>Interview Rating Form</h2>
            </div>
            <div className="ratings-total-box">
              <span>Total Score</span>
              <strong>{totalRatingScore}/50</strong>
            </div>
          </div>

          <div className="ratings-form-details">
            <dl className="ratings-applicant-details" aria-label="Applicant interview details">
              <div className="ratings-detail-row">
                <dt>Name:</dt>
                <dd>{selectedApplicant.name || '(No name)'}</dd>
              </div>
              <div className="ratings-detail-row">
                <dt>Position Applied:</dt>
                <dd>{getPosition(selectedApplicant)}</dd>
              </div>
              <div className="ratings-detail-row">
                <dt>Date of Interview:</dt>
                <dd>{interviewDate}</dd>
              </div>
            </dl>

            <div className="ratings-board-block">
              <span className="ratings-board-label">Board Members</span>
              <CustomDropdown
                className="ratings-board-dropdown"
                options={boardMembers.map((member) => ({ value: member, label: member }))}
                value={selectedBoardMember}
                onChange={setSelectedBoardMember}
                placeholder="Board Members"
              />
              {selectedBoardMemberAlreadyRated && (
                <p className="ratings-board-warning">
                  {selectedBoardMember} has already rated this applicant.
                </p>
              )}
            </div>
          </div>

          <div className="ratings-form-shell">
            <div className="ratings-form-scroll">
              <table className="ratings-form-table">
                <thead>
                  <tr>
                    <th className="ratings-form-criteria-head" rowSpan={2}>Criteria</th>
                    <th className="ratings-form-score-head" colSpan={ratingBands.length}>Rate / Score</th>
                  </tr>
                  <tr>
                    {ratingBands.map((band) => (
                      <th key={band.value}>
                        <span>{band.label}</span>
                        <small>({band.range})</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ratingCriteria.map((criterion, index) => (
                    <tr key={criterion}>
                      <td className="ratings-form-criterion">
                        <span>{index + 1}.</span>
                        <strong>{criterion}</strong>
                      </td>
                      {ratingBands.map((band) => (
                        <td key={`${criterion}-${band.value}`} className="ratings-radio-cell">
                          <label className="ratings-radio-choice">
                            <input
                              type="radio"
                              name={`rating-${index}`}
                              value={band.value}
                              checked={Number(ratingScores[criterion] || 0) === band.value}
                              onChange={() => {
                                setRatingScores((prev) => ({
                                  ...prev,
                                  [criterion]: band.value
                                }))
                              }}
                            />
                            <span aria-hidden="true" />
                          </label>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <label className="ratings-remarks-field">
            <span>Remarks <small>(Optional)</small></span>
            <textarea
              value={ratingRemarks}
              onChange={(event) => setRatingRemarks(event.target.value)}
              placeholder="Add any comments here..."
              maxLength={1000}
              rows={4}
            />
          </label>

          <div className="ratings-form-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setSelectedBoardMember('')
                setRatingRemarks('')
                setRatingStarted(false)
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn"
              disabled={selectedBoardMemberAlreadyRated}
              onClick={requestSaveRating}
            >
              Save Rating
            </button>
          </div>
        </section>
      )
    }

    return (
      <section className="ratings-applicant-view">
        {ratingNoticeNode}
        {ratingStarted && (
          <div className="ratings-started-banner">
            Rating started for {selectedApplicant.name || 'this applicant'}.
          </div>
        )}
        <section className="ratings-result-card">
          <div>
            <h3>Interview Rating</h3>
            <p>{ratingCount ? `${ratingCount} board member${ratingCount === 1 ? '' : 's'} rated this applicant.` : 'No board member has rated this applicant yet.'}</p>
          </div>
          <div className="ratings-result-score">
            <span>Total Score</span>
            <strong>{ratingLabel}</strong>
          </div>
          {applicantRatings.length > 0 && (
            <div className="ratings-rater-list">
              {applicantRatings.map((rating) => (
                <span key={rating.id}>
                  {rating.raterName || rating.rater_name || 'Board member'} · {Number(rating.totalScore ?? rating.total_score ?? 0)}/50 · {Number(rating.percentageScore ?? rating.percentage_score ?? 0).toFixed(0)}%
                </span>
              ))}
            </div>
          )}
        </section>
        <ApplicantViewPage
          viewItem={selectedApplicant}
          backLabel="Back to Ratings"
          onBack={() => {
            setSelectedApplicant(null)
            setRatingStarted(false)
            setRatingScores({})
            setRatingRemarks('')
            setSelectedBoardMember('')
          }}
          headerActions={(
          <button
            type="button"
            className="ratings-start-btn"
            onClick={() => {
              setRatingScores({})
              setRatingRemarks('')
              setSelectedBoardMember('')
              setRatingStarted(true)
            }}
          >
            Start Rating
          </button>
          )}
        />
      </section>
    )
  }

    return (
      <section className="ratings-page" aria-label="Ratings / Evaluation">
      {ratingNoticeNode}
      {ratingConfirmNode}
      <div className="ratings-header">
        <div>
          <h2>Ratings / Evaluation</h2>
          <p>View the list of applicants who passed the initial process or interview.</p>
        </div>
        <button type="button" className="ratings-edit-criteria-btn" onClick={openCriteriaEditor}>
          Edit Criteria
        </button>
      </div>

      <div className="ratings-toolbar">
        <div className="ratings-search-wrap">
          <span className="ratings-search-icon" aria-hidden="true" />
          <input
            className="ratings-search"
            type="text"
            placeholder="Search applicant..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <select
          className="ratings-position-select"
          value={positionFilter}
          onChange={(event) => setPositionFilter(event.target.value)}
        >
          {positionOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="ratings-table-shell">
        <div className="ratings-table-scroll">
          <table className="ratings-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Applicant Name</th>
                <th>Position Applied</th>
                <th>Date of Interview</th>
                <th>Status</th>
                <th>Score</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="ratings-empty">Loading applicants...</td>
                </tr>
              ) : filteredUploads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="ratings-empty">No applicants found.</td>
                </tr>
              ) : (
                filteredUploads.map((item, index) => (
                  <tr key={item.id || `${item.email}-${index}`}>
                    <td>{index + 1}</td>
                    <td className="ratings-name">{item.name || '(No name)'}</td>
                    <td>{getPosition(item)}</td>
                    <td>{formatInterviewDate(item.uploaded_at || item.updated_at || item.updatedAt)}</td>
                    <td>
                      <span className={`ratings-status ${getEvaluationStatus(item)}`}>
                        {getEvaluationStatusLabel(item)}
                      </span>
                    </td>
                    <td>
                      <span className={`ratings-score-chip ${(item.ratingCount || item.rating_count) ? 'has-rating' : ''}`}>
                        {item.ratingLabel || item.rating_label || 'No rating'}
                      </span>
                    </td>
                    <td className="ratings-action-cell">
                      <button
                        type="button"
                        className="action-btn action-trigger"
                        aria-label={`Open actions for ${item.name || 'applicant'}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          if (actionsMenu?.item?.id === item.id) {
                            setActionsMenu(null)
                            return
                          }
                          openActionsMenu(event, item)
                        }}
                      >
                        ...
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="ratings-count">
        Showing {filteredUploads.length} of {evaluationUploads.length} entries
      </p>

      {actionsMenu && (
        <div
          className="actions-menu actions-menu-floating"
          style={{ top: `${actionsMenu.top}px`, left: `${actionsMenu.left}px` }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="actions-menu-item"
            onClick={() => {
              setSelectedApplicant(actionsMenu.item)
              setRatingStarted(false)
              setRatingScores({})
              setRatingRemarks('')
              setSelectedBoardMember('')
              setActionsMenu(null)
            }}
          >
            View
          </button>
          {getEvaluationStatus(actionsMenu.item) === 'rated' && (
            <button
              type="button"
              className="actions-menu-item"
              onClick={() => exportRatingSummary(actionsMenu.item)}
            >
              Export Excel
            </button>
          )}
          <button
            type="button"
            className="actions-menu-item danger"
            onClick={() => openCancelConfirmation(actionsMenu.item)}
          >
            {isRatedApplicant(actionsMenu.item) ? 'Delete' : 'Cancel Interview'}
          </button>
        </div>
      )}
    </section>
  )
}

export default RatingsPage
