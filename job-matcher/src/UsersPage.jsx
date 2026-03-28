import { useCallback, useEffect, useState } from "react"
import "./UsersPage.css"

function UsersPage() {
  const [jobSeekerUsers, setJobSeekerUsers] = useState([])
  const [employerUsers, setEmployerUsers] = useState([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [usersError, setUsersError] = useState("")
  const [jobSeekerSearch, setJobSeekerSearch] = useState("")
  const [employerSearch, setEmployerSearch] = useState("")
  const [userEditContext, setUserEditContext] = useState(null)
  const [userForm, setUserForm] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    companyName: "",
    contactName: ""
  })
  const [userSaveStatus, setUserSaveStatus] = useState("")
  const [confirmDeleteUser, setConfirmDeleteUser] = useState(null)
  const [employerActionsMenu, setEmployerActionsMenu] = useState(null)
  const [isEmployerModalOpen, setIsEmployerModalOpen] = useState(false)
  const [employerForm, setEmployerForm] = useState({
    companyName: "",
    contactName: "",
    username: "",
    phone: "",
    password: ""
  })
  const [employerFormStatus, setEmployerFormStatus] = useState("")

  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true)
    setUsersError("")
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
      setUsersError(error.message || "Failed to load users.")
    } finally {
      setIsLoadingUsers(false)
    }
  }, [])

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
        contactName: ""
      })
    } else {
      setUserForm({
        fullName: "",
        username: "",
        email: user.email || "",
        phone: user.phone || "",
        companyName: user.companyName || "",
        contactName: user.contactName || ""
      })
    }
    setUserSaveStatus("")
  }

  const closeEditUser = () => {
    setUserEditContext(null)
    setUserSaveStatus("")
  }

  const saveEditedUser = async () => {
    if (!userEditContext?.user?.id) return
    setUserSaveStatus("Saving...")
    try {
      if (userEditContext.type === "jobseeker") {
        const response = await fetch(`http://localhost:5000/job-seekers/${userEditContext.user.id}/admin`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName: userForm.companyName,
            contactName: userForm.contactName,
            email: userForm.email,
            phone: userForm.phone
          })
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.message || "Failed to update employer.")
        }
      }
      await fetchUsers()
      setUserSaveStatus("Saved.")
      setTimeout(() => {
        closeEditUser()
      }, 600)
    } catch (error) {
      setUserSaveStatus(error.message || "Failed to save.")
    }
  }

  const confirmDelete = (type, user) => {
    setConfirmDeleteUser({ type, user })
  }

  const openEmployerModal = () => {
    setEmployerForm({
      companyName: "",
      contactName: "",
      username: "",
      phone: "",
      password: ""
    })
    setEmployerFormStatus("")
    setIsEmployerModalOpen(true)
  }

  const saveEmployer = async () => {
    const payload = {
      companyName: employerForm.companyName.trim(),
      contactName: employerForm.contactName.trim(),
      email: employerForm.username.trim(),
      phone: employerForm.phone.trim(),
      password: employerForm.password.trim()
    }
    if (!payload.companyName || !payload.email || !payload.password) {
      setEmployerFormStatus("Company name, username, and password are required.")
      return
    }
    setEmployerFormStatus("Saving...")
    try {
      const response = await fetch("http://localhost:5000/employers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      if (!response.ok) {
        const err = await response.json().catch(() => null)
        throw new Error(err?.message || "Failed to add employer.")
      }
      setEmployerFormStatus("Saved.")
      setIsEmployerModalOpen(false)
      await fetchUsers()
    } catch (error) {
      setEmployerFormStatus(error.message || "Failed to add employer.")
    }
  }


  return (
    <section className="users-page">
      <div className="users-header">
        <div>
          <h2>Users</h2>
          <p>Manage and review job seeker and employer accounts.</p>
        </div>
      </div>

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
              ) : usersError ? (
                <tr>
                  <td colSpan={6} className="users-empty">{usersError}</td>
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

      <section className="users-card users-card-employers">
        <div className="users-card-head">
          <h3>Employer Users</h3>
          <div className="users-actions">
            <input
              className="users-search"
              type="text"
              placeholder="Search employers..."
              value={employerSearch}
              onChange={(e) => setEmployerSearch(e.target.value)}
            />
            <button type="button" className="js-outline-btn users-add-btn" onClick={openEmployerModal}>Add Employer</button>
          </div>
        </div>
        <div className="table-wrap users-table-wrap users-table-inside">
          <div className="users-table-scroll">
            <table className="records-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Company</th>
                <th>Phone</th>
                <th>Username</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingUsers ? (
                <tr>
                  <td colSpan={7} className="users-empty">Loading employers...</td>
                </tr>
              ) : usersError ? (
                <tr>
                  <td colSpan={7} className="users-empty">{usersError}</td>
                </tr>
              ) : filteredEmployers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="users-empty">No employer users found.</td>
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
                    <td>{user.phone || "-"}</td>
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

      {userEditContext && (
        <div className="modal-overlay" onClick={closeEditUser}>
          <div className="modal-card modal-modern js-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit {userEditContext.type === "jobseeker" ? "Job Seeker" : "Employer"}</h3>
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
                      <label>Company Name</label>
                      <input
                        className="input"
                        value={userForm.companyName}
                        onChange={(e) => setUserForm((prev) => ({ ...prev, companyName: e.target.value }))}
                      />
                    </div>
                    <div className="field-group">
                      <label>Contact Name</label>
                      <input
                        className="input"
                        value={userForm.contactName}
                        onChange={(e) => setUserForm((prev) => ({ ...prev, contactName: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="modal-grid">
                    <div className="field-group">
                      <label>Username</label>
                      <input
                        className="input"
                        type="text"
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
              )}
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={saveEditedUser}>Save</button>
              <button className="btn btn-secondary" onClick={closeEditUser}>Cancel</button>
              {userSaveStatus && <span className="muted">{userSaveStatus}</span>}
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
            <h3>Delete {confirmDeleteUser.type === "jobseeker" ? "Job Seeker" : "Employer"}</h3>
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
                  setConfirmDeleteUser(null)
                  if (!target?.user?.id) return
                  try {
                    if (target.type === "jobseeker") {
                      const response = await fetch(`http://localhost:5000/job-seekers/${target.user.id}`, {
                        method: "DELETE"
                      })
                      if (!response.ok) {
                        const payload = await response.json().catch(() => null)
                        throw new Error(payload?.message || "Failed to delete job seeker.")
                      }
                    } else {
                      const response = await fetch(`http://localhost:5000/employers/${target.user.id}`, {
                        method: "DELETE"
                      })
                      if (!response.ok) {
                        const payload = await response.json().catch(() => null)
                        throw new Error(payload?.message || "Failed to delete employer.")
                      }
                    }
                    await fetchUsers()
                  } catch (error) {
                    setUsersError(error.message || "Failed to delete user.")
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
              <h3>Add Employer</h3>
              <button type="button" className="close-x" onClick={() => setIsEmployerModalOpen(false)}>×</button>
            </div>
            <div className="js-edit-body">
              <div className="modal-grid">
                <div className="field-group">
                  <label>Company Name</label>
                  <input
                    className="input"
                    value={employerForm.companyName}
                    onChange={(e) => setEmployerForm((prev) => ({ ...prev, companyName: e.target.value }))}
                  />
                </div>
                <div className="field-group">
                  <label>Contact Name</label>
                  <input
                    className="input"
                    value={employerForm.contactName}
                    onChange={(e) => setEmployerForm((prev) => ({ ...prev, contactName: e.target.value }))}
                  />
                </div>
              </div>
              <div className="modal-grid">
                <div className="field-group">
                  <label>Username</label>
                  <input
                    className="input"
                    value={employerForm.username}
                    onChange={(e) => setEmployerForm((prev) => ({ ...prev, username: e.target.value }))}
                  />
                </div>
                <div className="field-group">
                  <label>Phone</label>
                  <input
                    className="input"
                    value={employerForm.phone}
                    onChange={(e) => setEmployerForm((prev) => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
              </div>
              <div className="modal-grid">
                <div className="field-group">
                  <label>Password</label>
                  <input
                    className="input"
                    type="password"
                    value={employerForm.password}
                    onChange={(e) => setEmployerForm((prev) => ({ ...prev, password: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={saveEmployer}>Save</button>
              <button className="btn btn-secondary" onClick={() => setIsEmployerModalOpen(false)}>Cancel</button>
              {employerFormStatus && <span className="muted">{employerFormStatus}</span>}
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

    </section>
  )
}

export default UsersPage
