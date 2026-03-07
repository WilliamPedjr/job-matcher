import './App.css'

const JOB_POSTINGS = [
  {
    id: 1,
    title: 'Secondary School English Teacher',
    status: 'active',
    department: 'Academic Affairs',
    location: 'Manila, Philippines',
    type: 'Full-time',
    description:
      "We are seeking a passionate and dedicated Secondary School English Teacher to join our academic team. The successful candidate will be responsible for planning and delivering engaging lessons aligned with the curriculum, assessing student performance, preparing instructional materials, and fostering a positive learning environment.",
    applicants: 0
  },
  {
    id: 2,
    title: 'Junior Software Developer',
    status: 'closed',
    department: 'Information Technology',
    location: 'Manila, Philippines',
    type: 'Full-time',
    description:
      'We are seeking a motivated and detail-oriented Junior Software Developer to join our IT team. The successful candidate will assist in designing, developing, testing, and maintaining web-based applications. Responsibilities include writing clean and efficient code, debugging and troubleshooting system issues, and collaborating with senior developers.',
    applicants: 1
  }
]

function JobPostingPage() {
  return (
    <section className="jobs-panel">
      <h1 className="jobs-title">New Jobs</h1>
      <p className="jobs-subtitle">Overview of Job List and Requirements</p>

      <div className="jobs-controls">
        <input className="input jobs-search" type="text" placeholder="Search jobs.." />
        <select className="input jobs-filter">
          <option>All Status</option>
          <option>Active</option>
          <option>Closed</option>
        </select>
      </div>

      <div className="jobs-list">
        {JOB_POSTINGS.map((job) => (
          <article key={job.id} className="job-card">
            <div className="job-card-top">
              <div className="job-main">
                <h2>{job.title}</h2>
                <span className={`job-status ${job.status}`}>{job.status}</span>
              </div>
              <button className="job-more" type="button">...</button>
            </div>

            <p className="job-meta">
              {job.department}  |  {job.location}  |  {job.type}
            </p>

            <p className="job-description">{job.description}</p>

            <button className="job-applicants" type="button">
              {job.applicants} Applicants
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}

export default JobPostingPage
