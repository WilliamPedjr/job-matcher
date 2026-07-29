import React, { useEffect, useMemo, useRef, useState } from 'react'
import '../styles/RatingsPage.css'
import ApplicantViewPage from './ApplicantViewPage'
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

const ratingCriteria = [
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

const ratingBands = [
  { label: 'Outstanding', range: '41 - 50', value: 5 },
  { label: 'Very Satisfactory', range: '31 - 40', value: 4 },
  { label: 'Satisfactory', range: '21 - 30', value: 3 },
  { label: 'Below Satisfactory', range: '11 - 20', value: 2 },
  { label: 'Unsatisfactory', range: '10 & below', value: 1 }
]

function RatingsPage({ uploads = [], isLoading = false, currentUser = null, onRatingsChanged }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [positionFilter, setPositionFilter] = useState('all')
  const [selectedApplicant, setSelectedApplicant] = useState(null)
  const [ratingStarted, setRatingStarted] = useState(false)
  const [ratingScores, setRatingScores] = useState({})
  const [actionsMenu, setActionsMenu] = useState(null)
  const [confirmRatingAction, setConfirmRatingAction] = useState(null)
  const [cancelledIds, setCancelledIds] = useState([])
  const [ratingNotice, setRatingNotice] = useState(null)
  const ratingNoticeTimer = useRef(null)

  const evaluationUploads = useMemo(() => (
    uploads.filter((item) => ['for_evaluation', 'rated'].includes(String(item.evaluation_status || item.evaluationStatus || '').toLowerCase()))
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raterName: currentUser?.name || currentUser?.email || 'Unknown account',
          raterEmail: currentUser?.email || '',
          scores
        })
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to save rating.')
      }
      setSelectedApplicant(payload)
      setRatingScores({})
      setRatingStarted(false)
      onRatingsChanged?.()
      showRatingNotice('success', 'Rating saved successfully.')
    } catch (error) {
      showRatingNotice('fail', error.message || 'Failed to save rating.')
    }
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

  const openCancelConfirmation = (item) => {
    if (!item?.id) return
    setActionsMenu(null)
    setConfirmRatingAction(item)
  }

  const closeCancelConfirmation = () => {
    setConfirmRatingAction(null)
  }

  const isRatedApplicant = (item) => Boolean(item?.ratingCount || item?.rating_count || (Array.isArray(item?.ratings) && item.ratings.length))
  const hasCurrentUserRated = (item) => {
    const ratings = Array.isArray(item?.ratings) ? item.ratings : []
    const currentEmail = String(currentUser?.email || '').trim().toLowerCase()
    const currentName = String(currentUser?.name || '').trim().toLowerCase()

    return ratings.some((rating) => {
      const raterEmail = String(rating.raterEmail || rating.rater_email || '').trim().toLowerCase()
      const raterName = String(rating.raterName || rating.rater_name || '').trim().toLowerCase()
      if (currentEmail && raterEmail) return currentEmail === raterEmail
      return Boolean(currentName && raterName && currentName === raterName)
    })
  }

  useEffect(() => {
    if (selectedApplicant && ratingStarted && hasCurrentUserRated(selectedApplicant)) {
      setRatingStarted(false)
    }
  }, [ratingStarted, selectedApplicant, currentUser])

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

  if (selectedApplicant) {
    const applicantRatings = Array.isArray(selectedApplicant.ratings) ? selectedApplicant.ratings : []
    const ratingLabel = selectedApplicant.ratingLabel || selectedApplicant.rating_label || 'No rating'
    const ratingCount = Number(selectedApplicant.ratingCount || selectedApplicant.rating_count || applicantRatings.length || 0)
    const currentUserAlreadyRated = hasCurrentUserRated(selectedApplicant)
    const canOpenRatingForm = ratingStarted && !currentUserAlreadyRated

    if (canOpenRatingForm) {
      return (
        <section className="ratings-form-page" aria-label="Interview rating form">
          {ratingNoticeNode}
          <div className="ratings-form-header">
            <div>
              <button
                type="button"
                className="ratings-back-link"
                onClick={() => setRatingStarted(false)}
              >
                Back to Applicant Summary
              </button>
              <h2>Interview Rating Form</h2>
              <p>
                {selectedApplicant.name || '(No name)'} · {getPosition(selectedApplicant)}
              </p>
            </div>
            <div className="ratings-total-box">
              <span>Total Score</span>
              <strong>{totalRatingScore}/50</strong>
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

          <div className="ratings-form-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setRatingStarted(false)}
            >
              Cancel
            </button>
            <button type="button" className="btn" onClick={saveRating}>
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
            <p>{ratingCount ? `${ratingCount} account${ratingCount === 1 ? '' : 's'} rated this applicant.` : 'No account has rated this applicant yet.'}</p>
          </div>
          <div className="ratings-result-score">
            <span>Total Score</span>
            <strong>{ratingLabel}</strong>
          </div>
          {applicantRatings.length > 0 && (
            <div className="ratings-rater-list">
              {applicantRatings.map((rating) => (
                <span key={rating.id}>
                  {rating.raterName || rating.rater_name || rating.raterEmail || rating.rater_email || 'Unknown account'} · {Number(rating.percentageScore ?? rating.percentage_score ?? 0).toFixed(0)}%
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
          }}
          headerActions={(
          <button
            type="button"
            className="ratings-start-btn"
            disabled={currentUserAlreadyRated}
            onClick={() => {
              setRatingScores({})
              setRatingStarted(true)
            }}
          >
            {currentUserAlreadyRated ? 'Already Rated' : 'Start Rating'}
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
        <h2>Ratings / Evaluation</h2>
        <p>View the list of applicants who passed the initial process or interview.</p>
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
                      <span className="ratings-status">For Evaluation</span>
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
              setActionsMenu(null)
            }}
          >
            View
          </button>
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
