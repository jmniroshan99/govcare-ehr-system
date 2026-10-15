# AI Report API Specification

GET /api/reports/ai-assessments

Filters:
hospitalId
departmentId
fromDate
toDate
patientId
doctorId
diagnosis
status
ageGroup

Response fields:
id
patientCode
patientName
age
diagnosis
aiModule
riskLevel
prediction
doctor
createdDate
