import React from 'react'
import { useCallback, useEffect, useRef, useState } from "react"
import "../styles/UsersPage.css"
import eyeSolidIcon from "../assets/eye-solid-full.svg"
import eyeRegularIcon from "../assets/eye-regular-full.svg"
import { getArchiveActorHeaders } from "../utils/archiveActor"

function UsersPage({ currentUser = null, onUsersChanged }) {
  const [jobSeekerUsers, setJobSeekerUsers] = useState([])
  const [employerUsers, setEmployerUsers] = useState([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [jobSeekerSearch, setJobSeekerSearch] = useState("")
  const [employerSearch, setEmployerSearch] = useState("")
  const [activeUserTab, setActiveUserTab] = useState("jobseekers")
  const [userEditContext, setUserEditContext] = useState(null)
  const [userForm, setUserForm] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    companyName: "",
    contactName: "",
    idNumber: ""
  })
  const [confirmDeleteUser, setConfirmDeleteUser] = useState(null)
  const [employerActionsMenu, setEmployerActionsMenu] = useState(null)
  const [isEmployerModalOpen, setIsEmployerModalOpen] = useState(false)
  const [showEmployerPassword, setShowEmployerPassword] = useState(false)
  const [employerForm, setEmployerForm] = useState({
    companyName: "",
    contactName: "",
    accountIdentifier: "",
    username: "",
    email: "",
    idNumber: "",
    phone: "",
    password: ""
  })
  const [toast, setToast] = useState(null)
  const toastTimerRef = useRef(null)

  const showToast = useCallback((message, type = "info", duration = 2600) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current)
      toastTimerRef.current = null
    }
    setToast({ message, type })
    if (duration > 0) {
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null)
        toastTimerRef.current = null
      }, duration)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current)
      }
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true)
    try {
      const [jobSeekerResponse, employerResponse] = await Promise.all([
        fetch("http://localhost:5000/job-seekers/all"),
        fetch("http://localhost:5000/employers")
      ])
      if (!jobSeekerResponse.ok) {
        const payload = await jobSeekerResponse.json().catch(() => null)
        throw new Error(payload?.message || "Failed to load job seekers.")
      }
      if (!employerResponse.ok) {
        const payload = await employerResponse.json().catch(() => null)
        throw new Error(payload?.message || "Failed to load employers.")
      }
      const jobSeekerData = await jobSeekerResponse.json()
      const employerData = await employerResponse.json()
      setJobSeekerUsers(Array.isArray(jobSeekerData) ? jobSeekerData : [])
      setEmployerUsers(Array.isArray(employerData) ? employerData : [])
    } catch (error) {
      showToast(error.message || "Failed to load users.", "fail")
      setJobSeekerUsers([])
      setEmployerUsers([])
    } finally {
      setIsLoadingUsers(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  useEffect(() => {
    if (!employerActionsMenu) return
    const handleClick = () => setEmployerActionsMenu(null)
    window.addEventListener("click", handleClick)
    window.addEventListener("resize", handleClick)
    window.addEventListener("scroll", handleClick, true)
    return () => {
      window.removeEventListener("click", handleClick)
      window.removeEventListener("resize", handleClick)
      window.removeEventListener("scroll", handleClick, true)
    }
  }, [employerActionsMenu])

  const openEmployerActionsMenu = (event, user) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setEmployerActionsMenu({
      user,
      top: rect.bottom + 6,
      left: Math.max(12, rect.right - 140)
    })
  }


  const formatDate = (value) => {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return "-"
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  }

  const filteredJobSeekers = jobSeekerUsers.filter((user) => {
    const query = jobSeekerSearch.trim().toLowerCase()
    if (!query) return true
    const haystack = [
      user.fullName,
      user.email,
      user.username,
      user.phone
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
    return haystack.includes(query)
  })

  const filteredEmployers = employerUsers.filter((user) => {
    const query = employerSearch.trim().toLowerCase()
    if (!query) return true
    const haystack = [
      user.companyName,
      user.contactName,
      user.email,
      user.username,
      user.idNumber,
      user.id_number,
      user.phone
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
    return haystack.includes(query)
  })

  const openEditUser = (type, user) => {
    setUserEditContext({ type, user })
    if (type === "jobseeker") {
      setUserForm({
        fullName: user.fullName || "",
        username: user.username || "",
        email: user.email || "",
        phone: user.phone || "",
        companyName: "",
        contactName: "",
        idNumber: ""
      })
    } else {
      const digitsOnly = String(user.phone || "").replace(/\D/g, "")
      const withoutCountryPrefix = digitsOnly.startsWith("63") ? digitsOnly.slice(2) : digitsOnly
      const withoutLocalPrefix = withoutCountryPrefix.startsWith("0")
        ? withoutCountryPrefix.slice(1)
        : withoutCountryPrefix
      setUserForm({
        fullName: "",
        username: user.username || "",
        email: user.email || "",
        phone: withoutLocalPrefix.slice(0, 10),
        companyName: user.companyName || "",
        contactName: user.contactName || "",
        idNumber: user.idNumber || user.id_number || ""
      })
    }
    setToast(null)
  }

  const closeEditUser = () => {
    setUserEditContext(null)
  }

  const saveEditedUser = async () => {
    if (!userEditContext?.user?.id) return
    showToast("Saving...", "info", 1800)
    try {
      if (userEditContext.type === "jobseeker") {
        const response = await fetch(`http://localhost:5000/job-seekers/${userEditContext.user.id}/admin`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...getArchiveActorHeaders(currentUser)
          },
          body: JSON.stringify({
            fullName: userForm.fullName,
            username: userForm.username,
            email: userForm.email,
            phone: userForm.phone
          })
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.message || "Failed to update job seeker.")
        }
      } else {
        const response = await fetch(`http://localhost:5000/employers/${userEditContext.user.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...getArchiveActorHeaders(currentUser)
          },
          body: JSON.stringify({
            companyName: userForm.companyName,
            contactName: userForm.contactName,
            username: userForm.username,
            email: userForm.email,
            idNumber: userForm.idNumber,
            phone: userForm.phone
          })
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.message || "Failed to update employer.")
        }
      }
      await fetchUsers()
      showToast("Personnel account updated successfully.", "success")
      setTimeout(() => {
        closeEditUser()
      }, 600)
    } catch (error) {
      showToast(error.message || "Failed to save.", "fail")
    }
  }

  const confirmDelete = (type, user) => {
    setConfirmDeleteUser({ type, user })
  }

  const restoreScrollPosition = (scrollX, scrollY) => {
    window.requestAnimationFrame(() => {
      window.scrollTo(scrollX, scrollY)
    })
  }

  const openEmployerModal = () => {
    setEmployerForm({
      companyName: "",
      contactName: "",
      accountIdentifier: "",
      username: "",
      email: "",
      idNumber: "",
      phone: "",
      password: ""
    })
    setShowEmployerPassword(false)
    setIsEmployerModalOpen(true)
  }

  const saveEmployer = async () => {
    const phoneDigits = String(employerForm.phone || "").replace(/\D/g, "")
    const withoutCountryPrefix = phoneDigits.startsWith("63") ? phoneDigits.slice(2) : phoneDigits
    const withoutLocalPrefix = withoutCountryPrefix.startsWith("0")
      ? withoutCountryPrefix.slice(1)
      : withoutCountryPrefix
    const normalizedPhone = withoutLocalPrefix ? `+63${withoutLocalPrefix.slice(0, 10)}` : ""
    const idNumber = employerForm.accountIdentifier.trim()
    const emailValue = employerForm.email.trim()
    const payload = {
      companyName: employerForm.companyName.trim(),
      contactName: employerForm.contactName.trim(),
      username: emailValue,
      email: emailValue,
      idNumber,
      phone: normalizedPhone,
      password: employerForm.password.trim()
    }
    if (!payload.companyName || !idNumber || !emailValue || !payload.password) {
      showToast("Name, ID number, email, and password are required.", "fail")
      return
    }
    showToast("Saving...", "info", 1800)
    try {
      const response = await fetch("http://localhost:5000/employers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getArchiveActorHeaders(currentUser)
        },
        body: JSON.stringify(payload)
      })
      if (!response.ok) {
        const err = await response.json().catch(() => null)
        throw new Error(err?.message || "Failed to add Personnel.")
      }
      showToast("Personnel account created successfully.", "success")
      setIsEmployerModalOpen(false)
      await fetchUsers()
      await onUsersChanged?.()
    } catch (error) {
      showToast(error.message || "Failed to add Personnel.", "fail")
    }
  }


  return (
    <section className="users-page">
      <div className="users-hero">
        <div>
          <p className="users-kicker">User Management</p>
          <h2 className="users-title">Users</h2>
          <p className="users-subtitle">Manage and review job seeker and employer accounts.</p>
        </div>
      </div>

      <div className="users-tabs" role="tablist" aria-label="User tables">
        <button
          type="button"
          className={`users-tab ${activeUserTab === "jobseekers" ? "is-active" : ""}`}
          onClick={() => setActiveUserTab("jobseekers")}
          role="tab"
          aria-selected={activeUserTab === "jobseekers"}
        >
          Job Seekers
          <span>{jobSeekerUsers.length}</span>
        </button>
        <button
          type="button"
          className={`users-tab ${activeUserTab === "personnel" ? "is-active" : ""}`}
          onClick={() => setActiveUserTab("personnel")}
          role="tab"
          aria-selected={activeUserTab === "personnel"}
        >
          HR Personnel
          <span>{employerUsers.length}</span>
        </button>
      </div>

      {activeUserTab === "jobseekers" && (
      <section className="users-card users-card-employers">
        <div className="users-card-head">
          <h3>Job Seeker Users</h3>
          <input
            className="users-search"
            type="text"
            placeholder="Search job seekers..."
            value={jobSeekerSearch}
            onChange={(e) => setJobSeekerSearch(e.target.value)}
          />
        </div>
        <div className="table-wrap users-table-wrap users-table-inside">
          <div className="users-table-scroll">
            <table className="records-table">
            <thead>
              <tr>
                <th>#</th>
                <th>User</th>
                <th>Phone</th>
                <th>Username</th>
                <th>Email</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingUsers ? (
                <tr>
                  <td colSpan={6} className="users-empty">Loading job seekers...</td>
                </tr>
              ) : filteredJobSeekers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="users-empty">No job seeker users found.</td>
                </tr>
              ) : (
                filteredJobSeekers.map((user, index) => (
                  <tr key={`jobseeker-${user.id}`}>
                    <td>{index + 1}</td>
                    <td>
                      <div className="applicant-cell">
                        <strong>{user.fullName || "-"}</strong>
                        <span>{user.email || "-"}</span>
                      </div>
                    </td>
                    <td>{user.phone || "-"}</td>
                    <td>{user.username || "-"}</td>
                    <td>{user.email || "-"}</td>
                    <td>{formatDate(user.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      </section>
      )}

      {activeUserTab === "personnel" && (
      <section className="users-card users-card-employers">
        <div className="users-card-head">
          <h3>HR Personnel Users</h3>
          <div className="users-actions">
            <input
              className="users-search"
              type="text"
              placeholder="Search Personnel..."
              value={employerSearch}
              onChange={(e) => setEmployerSearch(e.target.value)}
            />
            <button type="button" className="js-outline-btn users-add-btn" onClick={openEmployerModal}>Add Personnel</button>
          </div>
        </div>
        <div className="table-wrap users-table-wrap users-table-inside">
          <div className="users-table-scroll">
            <table className="records-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Position</th>
                <th>Phone</th>
                <th>Username</th>
                <th>Email</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingUsers ? (
                <tr>
                  <td colSpan={8} className="users-empty">Loading employers...</td>
                </tr>
              ) : filteredEmployers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="users-empty">No Personnel users found.</td>
                </tr>
              ) : (
                filteredEmployers.map((user, index) => (
                  <tr key={`employer-${user.id}`}>
                    <td>{index + 1}</td>
                    <td>
                      <div className="applicant-cell">
                        <strong>{user.companyName || "-"}</strong>
                        <span>{user.email || "-"}</span>
                      </div>
                    </td>
                    <td>{user.contactName || "-"}</td>
                    <td>{user.phone || "-"}</td>
                    <td>{user.username || "-"}</td>
                    <td>{user.email || "-"}</td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td className="actions-cell">
                      <button
                        type="button"
                        className="action-btn action-trigger"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEmployerActionsMenu(e, user)
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
      </section>
      )}

      {userEditContext && (
        <div className="modal-overlay" onClick={closeEditUser}>
          <div className="modal-card modal-modern js-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit {userEditContext.type === "jobseeker" ? "Job Seeker" : "Personnel"}</h3>
              <button type="button" className="close-x" onClick={closeEditUser}>×</button>
            </div>
            <div className="js-edit-body">
              {userEditContext.type === "jobseeker" ? (
                <>
                  <div className="modal-grid">
                    <div className="field-group">
                      <label>Full Name</label>
                      <input
                        className="input"
                        value={userForm.fullName}
                        onChange={(e) => setUserForm((prev) => ({ ...prev, fullName: e.target.value }))}
                      />
                    </div>
                    <div className="field-group">
                      <label>Username</label>
                      <input
                        className="input"
                        value={userForm.username}
                        onChange={(e) => setUserForm((prev) => ({ ...prev, username: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="modal-grid">
                    <div className="field-group">
                      <label>Email</label>
                      <input
                        className="input"
                        type="email"
                        value={userForm.email}
                        onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                    <div className="field-group">
                      <label>Phone</label>
                      <input
                        className="input"
                        value={userForm.phone}
                        onChange={(e) => setUserForm((prev) => ({ ...prev, phone: e.target.value }))}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="modal-grid">
                    <div className="field-group">
                      <label>Name</label>
                      <input
                        className="input"
                        value={userForm.companyName}
                        onChange={(e) => setUserForm((prev) => ({ ...prev, companyName: e.target.value }))}
                      />
                    </div>
                    <div className="field-group">
                      <label>Position</label>
                      <input
                        className="input"
                        value={userForm.contactName}
                        onChange={(e) => setUserForm((prev) => ({ ...prev, contactName: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="modal-grid">
                    <div className="field-group">
                      <label>ID Number</label>
                      <input
                        className="input"
                        value={userForm.idNumber}
                        onChange={(e) => setUserForm((prev) => ({ ...prev, idNumber: e.target.value }))}
                      />
                    </div>
                    <div className="field-group">
                      <label>Username</label>
                      <input
                        className="input"
                        type="text"
                        value={userForm.username}
                        onChange={(e) => setUserForm((prev) => ({ ...prev, username: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="modal-grid">
                    <div className="field-group">
                      <label>Email</label>
                      <input
                        className="input"
                        type="email"
                        value={userForm.email}
                        onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                    <div className="field-group">
                      <label>Phone</label>
                      <input
                        className="input"
                        inputMode="numeric"
                        value={`+63${userForm.phone}`}
                        onChange={(e) => {
                          const digitsOnly = String(e.target.value || "").replace(/\D/g, "")
                          const withoutCountryPrefix = digitsOnly.startsWith("63") ? digitsOnly.slice(2) : digitsOnly
                          const withoutLocalPrefix = withoutCountryPrefix.startsWith("0")
                            ? withoutCountryPrefix.slice(1)
                            : withoutCountryPrefix
                          setUserForm((prev) => ({ ...prev, phone: withoutLocalPrefix.slice(0, 10) }))
                        }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={saveEditedUser}>Save</button>
              <button className="btn btn-secondary" onClick={closeEditUser}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteUser && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setConfirmDeleteUser(null)
            }
          }}
        >
          <div className="modal-card">
            <h3>Delete {confirmDeleteUser.type === "jobseeker" ? "Job Seeker" : "Personnel"}</h3>
            <p>Are you sure you want to delete this user? This action cannot be undone.</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmDeleteUser(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  const target = confirmDeleteUser
                  const scrollX = window.scrollX
                  const scrollY = window.scrollY
                  setConfirmDeleteUser(null)
                  if (!target?.user?.id) return
                  try {
                    if (target.type === "jobseeker") {
                      const response = await fetch(`http://localhost:5000/job-seekers/${target.user.id}`, {
                        method: "DELETE",
                        headers: getArchiveActorHeaders(currentUser)
                      })
                      if (!response.ok) {
                        const payload = await response.json().catch(() => null)
                        throw new Error(payload?.message || "Failed to delete job seeker.")
                      }
                    } else {
                      const response = await fetch(`http://localhost:5000/employers/${target.user.id}`, {
                        method: "DELETE",
                        headers: getArchiveActorHeaders(currentUser)
                      })
                      if (!response.ok) {
                        const payload = await response.json().catch(() => null)
                        throw new Error(payload?.message || "Failed to delete employer.")
                      }
                    }
                    await fetchUsers()
                    restoreScrollPosition(scrollX, scrollY)
                    showToast(
                      `${target.type === "jobseeker" ? "Job seeker" : "Personnel"} deleted successfully.`,
                      "success"
                    )
                  } catch (error) {
                    restoreScrollPosition(scrollX, scrollY)
                    showToast(error.message || "Failed to delete user.", "fail")
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {isEmployerModalOpen && (
        <div className="modal-overlay" onClick={() => setIsEmployerModalOpen(false)}>
          <div className="modal-card modal-modern js-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add HR Personnel</h3>
              <button type="button" className="close-x" onClick={() => setIsEmployerModalOpen(false)}>×</button>
            </div>
            <div className="js-edit-body">
              <div className="modal-grid">
                <div className="field-group">
                  <label>Name</label>
                  <input
                    placeholder="eg. John"
                    className="input"
                    value={employerForm.companyName}
                    onChange={(e) => setEmployerForm((prev) => ({ ...prev, companyName: e.target.value }))}
                  />
                </div>
                <div className="field-group">
                  <label>Position</label>
                  <input
                    className="input"
                    placeholder="eg. Administrative Officer ..."
                    value={employerForm.contactName}
                    onChange={(e) => setEmployerForm((prev) => ({ ...prev, contactName: e.target.value }))}
                  />
                </div>
              </div>
              <div className="modal-grid">
                <div className="field-group users-account-group">
                  <label>ID Number</label>
                  <input
                    className="input"
                    placeholder="Enter ID number"
                    value={employerForm.accountIdentifier}
                    onChange={(e) => setEmployerForm((prev) => ({ ...prev, accountIdentifier: e.target.value }))}
                  />
                </div>
                <div className="field-group">
                  <label>Email</label>
                  <input
                    className="input"
                    type="email"
                    placeholder="Enter email"
                    value={employerForm.email}
                    onChange={(e) => setEmployerForm((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>
              </div>
              <div className="modal-grid users-contact-row">
                <div className="field-group">
                  <label>Phone</label>
                  <input
                    className="input"
                    inputMode="numeric"
                    value={`+63${employerForm.phone}`}
                    onChange={(e) => {
                      const digitsOnly = String(e.target.value || "").replace(/\D/g, "")
                      const withoutCountryPrefix = digitsOnly.startsWith("63") ? digitsOnly.slice(2) : digitsOnly
                      const withoutLocalPrefix = withoutCountryPrefix.startsWith("0")
                        ? withoutCountryPrefix.slice(1)
                        : withoutCountryPrefix
                      setEmployerForm((prev) => ({ ...prev, phone: withoutLocalPrefix.slice(0, 10) }))
                    }}
                  />
                </div>
                <div className="field-group">
                  <label>Password</label>
                  <div className={`password-field-row ${showEmployerPassword ? "is-visible" : ""}`}>
                    <input
                      className="input"
                      type={showEmployerPassword ? "text" : "password"}
                      value={employerForm.password}
                      onChange={(e) => setEmployerForm((prev) => ({ ...prev, password: e.target.value }))}
                    />
                    <span
                      className={`password-toggle-icon ${showEmployerPassword ? "is-active" : ""}`}
                      role="button"
                      tabIndex={0}
                      aria-label={showEmployerPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowEmployerPassword((prev) => !prev)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          setShowEmployerPassword((prev) => !prev)
                        }
                      }}
                      >
                        <img src={showEmployerPassword ? eyeSolidIcon : eyeRegularIcon} alt="" />
                      </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={saveEmployer}>Save</button>
              <button className="btn btn-secondary" onClick={() => setIsEmployerModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {employerActionsMenu && (
        <div
          className="actions-menu actions-menu-floating"
          style={{ top: `${employerActionsMenu.top}px`, left: `${employerActionsMenu.left}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="actions-menu-item"
            onClick={() => {
              const target = employerActionsMenu
              setEmployerActionsMenu(null)
              if (target) {
                openEditUser("employer", target.user)
              }
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className="actions-menu-item danger"
            onClick={() => {
              const target = employerActionsMenu
              setEmployerActionsMenu(null)
              if (target) {
                confirmDelete("employer", target.user)
              }
            }}
          >
            Delete
          </button>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.type === "success" ? "toast-success" : toast.type === "fail" ? "toast-fail" : "toast-info"}`}>
          {toast.message}
        </div>
      )}

    </section>
  )
}

export default UsersPage
