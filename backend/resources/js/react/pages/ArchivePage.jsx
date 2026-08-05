import React, { useCallback, useEffect, useMemo, useState } from 'react'
import '../styles/ArchivePage.css'
import { getArchiveActorHeaders } from '../utils/archiveActor'

function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

function formatType(value) {
  const normalized = String(value || '').replace(/_/g, ' ')
  return normalized ? normalized.replace(/\b\w/g, (char) => char.toUpperCase()) : 'Record'
}

function getArchiveTitle(item, data) {
  if ((item.record_type || item.recordType) === 'rating') {
    return item.title || data.applicant?.name || data.applicant?.original_name || 'Deleted rating'
  }
  return item.title || data.companyName || data.company_name || data.fullName || data.full_name || data.name || data.title || 'Untitled record'
}

function getArchiveSubtitle(item, data) {
  if ((item.record_type || item.recordType) === 'rating') {
    return item.subtitle || data.applicant?.applied_job_title || data.applicant?.matched_job_title || data.rating_label || '-'
  }
  return item.subtitle || data.contactName || data.fullName || data.full_name || data.email || data.username || data.applied_job_title || data.department || '-'
}

function formatActorRole(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return ''
  if (normalized === 'jobseeker') return 'Job Seeker'
  if (normalized === 'employer') return 'Employer'
  if (normalized === 'admin') return 'Admin'
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase())
}

function ArchivePage({ currentUser = null, onArchiveChanged }) {
  const [archives, setArchives] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [notice, setNotice] = useState('')
  const [restoringId, setRestoringId] = useState(null)
  const [archivePage, setArchivePage] = useState(1)
  const archivePageSize = 10

  const fetchArchives = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch('http://localhost:5000/archives')
      if (!response.ok) {
        throw new Error('Failed to load archive records.')
      }
      const payload = await response.json()
      setArchives(Array.isArray(payload) ? payload : [])
    } catch (err) {
      setArchives([])
      setError(err.message || 'Failed to load archive records.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchArchives()
  }, [fetchArchives])

  const typeOptions = useMemo(() => {
    const types = Array.from(new Set(archives.map((item) => item.record_type || item.recordType).filter(Boolean)))
      .sort((a, b) => formatType(a).localeCompare(formatType(b)))
    return ['all', ...types]
  }, [archives])

  const filteredArchives = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return archives.filter((item) => {
      const type = item.record_type || item.recordType || ''
      if (typeFilter !== 'all' && type !== typeFilter) return false
      if (!query) return true

      const data = item.data || {}
      const haystack = [
        type,
        item.title,
        item.subtitle,
        data.email,
        data.phone,
        data.title,
        data.name,
        data.fullName,
        data.full_name,
        data.companyName,
        data.company_name,
        data.contactName,
        data.username,
        data.rating_label,
        data.applicant?.name,
        data.applicant?.email,
        data.applicant?.applied_job_title,
        ...(Array.isArray(data.ratings) ? data.ratings.map((rating) => [
          rating.raterName,
          rating.rater_name,
          rating.raterEmail,
          rating.rater_email,
          rating.percentageScore,
          rating.percentage_score
        ]).flat() : []),
        item.actorName,
        item.actor_name,
        item.actorEmail,
        item.actor_email,
        item.actorRole,
        item.actor_role,
        data.applied_job_title,
        data.appliedJobTitle
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [archives, searchTerm, typeFilter])

  useEffect(() => {
    setArchivePage(1)
  }, [searchTerm, typeFilter])

  const archivePageCount = Math.max(1, Math.ceil(filteredArchives.length / archivePageSize))
  const currentArchivePage = Math.min(archivePage, archivePageCount)
  const pagedArchives = filteredArchives.slice(
    (currentArchivePage - 1) * archivePageSize,
    currentArchivePage * archivePageSize
  )
  const pageStart = filteredArchives.length === 0 ? 0 : (currentArchivePage - 1) * archivePageSize + 1
  const pageEnd = Math.min(currentArchivePage * archivePageSize, filteredArchives.length)

  const restoreJob = async (archiveId) => {
    setRestoringId(archiveId)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`http://localhost:5000/archives/${archiveId}/restore-job`, {
        method: 'POST',
        headers: getArchiveActorHeaders(currentUser)
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to restore job.')
      }
      setArchives((prev) => prev.filter((item) => item.id !== archiveId))
      setNotice(payload?.message || 'Job restored successfully.')
      onArchiveChanged?.()
    } catch (err) {
      setError(err.message || 'Failed to restore job.')
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <section className="archive-page" aria-label="Archive">
      <div className="archive-header">
        <div>
          <h2>Archive</h2>
          <p>Deleted users, applications, and job posts are recorded here.</p>
        </div>
        <button type="button" className="archive-refresh-btn" onClick={fetchArchives}>
          Refresh
        </button>
      </div>

      <div className="archive-toolbar">
        <input
          className="archive-search"
          type="text"
          placeholder="Search archive..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
        <select
          className="archive-select"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
        >
          {typeOptions.map((type) => (
            <option key={type} value={type}>
              {type === 'all' ? 'All Records' : formatType(type)}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="archive-error">{error}</div>}
      {notice && <div className="archive-notice">{notice}</div>}

      <div className="archive-table-wrap">
        <table className="archive-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Type</th>
              <th>Record</th>
              <th>Details</th>
              <th>Action By</th>
              <th>Deleted At</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="archive-empty">Loading archive...</td>
              </tr>
            ) : filteredArchives.length === 0 ? (
              <tr>
                <td colSpan={7} className="archive-empty">No archive records found.</td>
              </tr>
            ) : (
              pagedArchives.map((item, index) => {
                const data = item.data || {}
                const type = item.record_type || item.recordType
                const recordTitle = getArchiveTitle(item, data)
                const recordSubtitle = getArchiveSubtitle(item, data)
                const actorName = item.actorName || item.actor_name || 'Unknown account'
                const actorEmail = item.actorEmail || item.actor_email || ''
                const actorRole = formatActorRole(item.actorRole || item.actor_role)
                return (
                  <tr key={item.id}>
                    <td>{(currentArchivePage - 1) * archivePageSize + index + 1}</td>
                    <td>
                      <span className={`archive-type archive-type-${String(type || '').replace(/_/g, '-')}`}>
                        {formatType(type)}
                      </span>
                    </td>
                    <td>
                      <div className="archive-record">
                        <strong>{recordTitle}</strong>
                        <span>{recordSubtitle}</span>
                      </div>
                    </td>
                    <td>
                      <div className="archive-details">
                        <span>ID: {item.record_id || item.recordId || '-'}</span>
                        {type === 'rating' && data.rating_label && <span>Score: {data.rating_label}</span>}
                        {type === 'rating' && data.rating_count != null && <span>Ratings: {data.rating_count}</span>}
                        {type === 'rating' && Array.isArray(data.ratings) && data.ratings.length > 0 && (
                          <span>
                            Rated by: {data.ratings.map((rating) => rating.raterName || rating.rater_name || rating.raterEmail || rating.rater_email || 'Unknown account').join(', ')}
                          </span>
                        )}
                        {(data.email || data.username) && <span>Username: {data.email || data.username}</span>}
                        {data.phone && <span>Phone: {data.phone}</span>}
                        {data.classification && <span>{data.classification}</span>}
                        {data.status && <span>Status: {data.status}</span>}
                      </div>
                    </td>
                    <td>
                      <div className="archive-record">
                        <strong>{actorName}</strong>
                        <span>{[actorEmail, actorRole].filter(Boolean).join(' · ') || '-'}</span>
                      </div>
                    </td>
                    <td>{formatDate(item.deleted_at || item.deletedAt)}</td>
                    <td>
                      {type === 'job' ? (
                        <button
                          type="button"
                          className="archive-restore-btn"
                          disabled={restoringId === item.id}
                          onClick={() => restoreJob(item.id)}
                        >
                          {restoringId === item.id ? 'Restoring...' : 'Restore'}
                        </button>
                      ) : (
                        <span className="archive-no-action">-</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="archive-pagination">
        <p className="archive-count">
          Showing {pageStart}-{pageEnd} of {filteredArchives.length} archived records
        </p>
        <div className="archive-page-controls">
          <button
            type="button"
            className="archive-page-btn"
            disabled={currentArchivePage === 1}
            onClick={() => setArchivePage((page) => Math.max(1, page - 1))}
          >
            Previous
          </button>
          <span>Page {currentArchivePage} of {archivePageCount}</span>
          <button
            type="button"
            className="archive-page-btn"
            disabled={currentArchivePage === archivePageCount}
            onClick={() => setArchivePage((page) => Math.min(archivePageCount, page + 1))}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  )
}

export default ArchivePage
