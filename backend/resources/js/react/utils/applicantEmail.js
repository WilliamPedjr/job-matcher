export function buildApplicantEmailDraft(item, senderEmail = "") {
  const email = String(item?.email || "").trim().replace(/[\s<>()[\]\\,;:"]+/g, "")
  if (!email) return null
  const sender = String(senderEmail || "").trim()
  const name = String(item?.name || "").trim()
  const title = String(item?.applied_job_title || item?.appliedJobTitle || item?.matched_job_title || "").trim()
  const jobTitle = title === "No position selected" ? "" : title
  const subject = jobTitle
    ? `LNU-HiRe | Application Correspondence: ${jobTitle}`
    : "LNU-HiRe | Application Correspondence"
  const body = `Dear ${name || "Applicant"},\n\nWe are writing regarding your application${jobTitle ? ` for the position of ${jobTitle}` : ""} at Leyte Normal University.\n\nThank you for your interest in serving the University. Should you require clarification regarding your application, please contact the hiring personnel.\n\nRespectfully,\nLNU-HiRe Personnel\nLeyte Normal University`

  return {
    email,
    gmail: `https://mail.google.com/mail/?view=cm&fs=1${sender ? `&authuser=${encodeURIComponent(sender)}` : ""}&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    mailto: `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }
}
