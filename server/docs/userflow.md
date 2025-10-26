Core User Flow
1. Upload & Configure

User uploads spreadsheet
Selects: Quarterly OR Yearly return
System validates file

2. Processing Path
Quarterly (Simple):

Extract: Total Income, Total Expenses, Profit
Show summary to user

Yearly (Detailed):

AI categorizes each transaction line-by-line
Groups by HMRC expense categories
Shows categorized summary to user

3. User Decision

Confirms: Store in DB → Submit now OR Submit later
Rejects: Manual mapping interface (drag/drop cells to categories)

4. Submission & Tracking

Store submission for audit
Track status: Draft → Submitted → Accepted/Rejected by HMRC
Update when HMRC confirms