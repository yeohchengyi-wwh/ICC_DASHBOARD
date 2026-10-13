# Dataset mapping

The prototype uses entirely fictional demonstration data in `data/dashboard.json`. The supplied `ICC_PowerBI_Dataset.xlsx` was inspected without modification and informed the field structure. No source names, contacts, addresses, identifiers, bank details or financial values are copied into the demo records.

The source is agreement-centered. It contains two licensing agreements and two licensed IP products. It has no incubator master, IP application dates or school classification. Those fields and the expanded portfolio are modeled additions for this prototype. The six school labels use UUM terminology: Technology Management & Logistics; Computing; Quantitative Sciences; Business Management; Applied Psychology, Social Work & Policy; and Multimedia Technology & Communication. Assignment of each fictional innovation or venture to a school is illustrative and is not asserted by the source workbook. The JSON retains the property `faculty` for front-end compatibility while the interface calls it School. The JSON includes `meta.isDemo: true` and uses the fixed reporting date 13 October 2026.

## Field mapping

| Demo field | Source structure | Treatment |
| --- | --- | --- |
| ip.id, title, type | IP_Products.IPProductID, ProductLicensed, IPType | Fictional identifiers and products with the same field meanings |
| ip.owner, faculty | Inventors.InventorName, Affiliation; Students.School | Fictional team owners and six UUM school labels with illustrative assignment |
| ip.applicationDate | Not present | Added fictional dates for 2024–2026 application trends |
| ip.expiryDate | Not present in IP_Products | Added illustrative portfolio renewal/review dates; not statutory protection expiry |
| ip.status | IP_Products.VerificationStatus | Simplified fictional workflow categories |
| commercialization.id, title, partner | License_Agreements.AgreementID, AgreementTitle, Licensee | Fictional demo agreements and counterparties |
| commercialization.agreementDate, expiryDate | License_Agreements.EffectiveDate, ExpiryDate | ISO dates; pipeline agreementDate represents engagement start before signing |
| commercialization.stage | License_Agreements.AgreementStatus, BusinessSandboxStatus | Added fictional commercialization stages |
| commercialization.revenue | Revenue_Statements.AmountRM, ReportingPeriod | Fictional collected RM totals, separate from contractual LicenseFeeRM |
| incubators | No incubator master in source | Entirely modeled venture, stage, sector, school and participation dates |
| activity | Supporting_Documents, Approvals_Governance, Compliance_Tasks | Fictional activity feed; source events are not reproduced |
| revenueStatements | Revenue_Statements | Fictional monthly statement ledger linked by agreement ID |

## Data conventions

- 36 IP records, 18 incubator ventures and 18 commercialization opportunities across 2024–2026.
- Every entity and revenue/activity record has a unique identifier. Each commercialization opportunity links to an existing IP record and incubator venture.
- Dates use ISO `YYYY-MM-DD`; monthly revenue periods use `YYYY-MM`. All application, effective and engagement dates are on or before the reporting date.
- Revenue is numeric collected RM, not currency-formatted strings. Statement amounts reconcile exactly to each agreement's revenue. Statements after the reporting date are excluded.
- Discovery and Negotiation stages have zero collected revenue. Warning onset is the expiry date minus three calendar months, clamped to the target month's last valid day. At the fixed reference date, the example upcoming expiries fall between 13 October 2026 and 13 January 2027, inclusive. Several historical expiries support overdue cases.
- IP expiry dates are demo administration dates. A production import must distinguish statutory protection expiry, maintenance/renewal deadlines and licensing expiry.
- Organisations, venture teams, products, amounts and events are fictional examples. Similarity to existing organisations is incidental.

## Observed workbook schema

Counts below exclude the first nonempty header row. `Dashboard` contains a summary title and content, so its count is not a record count. Source date columns are Excel numeric date cells. Currency and durations are numeric cells; identifiers and descriptive fields are strings.

| Sheet | Nonempty rows after header | Headers |
| --- | ---: | --- |
| Dashboard | 12 | Summary content rows, not portfolio records |
| Source_Files | 5 | SourceFileID, SourceFileName, AgreementID, Licensee, FileRole, PagesOrItemsCaptured, ProcessedStatus, PrimaryForAgreement, KeyNewInformation, Notes |
| License_Agreements | 2 | AgreementID, AgreementTitle, Licensor, Licensee, BusinessRegistrationNo, EffectiveDate, DurationYears, ExpiryDate, Territory, LicenseType, LicenseFor, SublicenseAllowed, LicenseFeeRM, RoyaltyFee, BusinessSandboxStatus, AgreementStatus, SourceFiles, Notes |
| Parties | 4 | PartyID, AgreementID, PartyRole, PartyName, RegistrationOrID, EntityType, Address, ContactPerson, Phone, Email, Notes |
| IP_Products | 2 | IPProductID, AgreementID, Licensee, ProductLicensed, IPType, FilingNo, Schedule, Territory, LicenseType, CommercialisationPillar, SourceFiles, VerificationStatus, Notes |
| Inventors | 5 | InventorID, AgreementID, IPProductID, InventorName, Identifier, Affiliation, Address, InventorCategory, SourceSchedule, Notes |
| Students | 3 | StudentID, AgreementID, StudentName, MatricNo, School, Address, ContactNumber, Email, RoleInAgreement, SourceSchedule, Notes |
| Invoices_Payments | 3 | TransactionID, AgreementID, Licensee, DocumentType, DocumentNo, DebtorNo, DocumentDate, AmountRM, Purpose, PaymentStatus, SourceFile, Notes |
| Stamp_Certificates | 2 | StampID, AgreementID, Licensee, AdjudicationNo, CertificateNo, InstrumentDate, StampingDate, StampDutyRM, PenaltyRM, AdjustmentRM, TotalPaidRM, ConsiderationRM, Endorsement, PrintedDate, SourceFiles, Notes |
| Supporting_Documents | 22 | DocumentID, AgreementID, SourceFileID, DocumentType, DocumentDate, DocumentReference, RelatedParty, Summary, DatasetUse, Status |
| Contacts_Notices | 6 | ContactID, AgreementID, PartyRole, Organisation, AttentionTo, OfficerInChargeOrContact, Address, Telephone, Fax, Email, SourceFile, Notes |
| Signatures | 10 | SignatureID, AgreementID, SourceFileID, SignatorySide, SignatoryName, Position, Organisation, SignatureRole, WitnessFor, Notes |
| Clauses_Obligations | 48 | ClauseRecordID, AgreementID, ClauseNo, ClauseTitle, ClauseCategory, ObligationOwner, ObligationSummary, TriggerOrFrequency, DashboardUse, RiskLevel, SourceFiles |
| Compliance_Tasks | 13 | TaskID, AgreementID, Licensee, TaskCategory, TaskDescription, Owner, DueDate, Frequency, Status, PowerBIFlag, SourceClause, Notes |
| Evidence_Log | 20 | EvidenceID, SourceFileID, AgreementID, PageOrDocument, EvidenceType, ExtractedInformation, DatasetImpact, Confidence, Notes |
| Data_Quality_Issues | 4 | IssueID, AgreementID, SourceFileID, IssueCategory, IssueDescription, ImpactOnPowerBI, ActionRequired, Priority, Status, ResolvedBy, Notes |
| Relationship_Model | 12 | Relationship, FromTable, FromColumn, ToTable, ToColumn, Cardinality, PowerBIUse |
| Data_Dictionary | 202 | SheetName, ColumnName, Description, DataType, Example |
| Categories | 14 | CategoryType, CategoryValue |
| Revenue_Statements | 3 | RevenueRecordID, AgreementID, Licensee, ProductLicensed, ReportingPeriod, IPNo, ProductService, AmountRM, CertifiedBy, CertifierRole, SourceFileID, EvidenceDocument, Notes |
| Bank_Statement_Summary | 1 | StatementID, AgreementID, Licensee, Bank, AccountNo, StatementPeriodStart, StatementPeriodEnd, AccountStatus, VisibleOpeningBalanceRM, VisibleTotalDebitRM, VisibleTotalCreditRM, VisibleClosingBalanceRM, SourceFileID, Notes |
| Approvals_Governance | 3 | ApprovalID, AgreementID, Licensee, DocumentType, ReferenceOrMeeting, DocumentDate, DecisionOrFinding, EvaluationSummary, SourceFileID, Notes |

## Production import

Map the agreement and IP identifiers first, then join revenue statements on AgreementID and inventor affiliations on IPProductID. Keep missing faculty, application and incubator fields explicit until authoritative registers are supplied. Define revenue recognition and deduplication rules before combining invoices, payments and revenue statements; those source tables describe different evidence and must not be summed together by default.
