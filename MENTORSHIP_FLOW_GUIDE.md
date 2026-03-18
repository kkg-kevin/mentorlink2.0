# MentorLink - Mentorship Request Flow Guide

## Overview
MentorLink supports two separate mentorship flows:
1. **Direct Mentorship**: Mentee → Mentor (independent mentorship)
2. **Organization-Managed Mentorship**: Mentee → Organization → Mentor (organization oversight)

**IMPORTANT**: Mentors and Organizations are completely separate entities and not linked.

---

## Flow 1: Direct Mentorship (Mentee → Mentor)

### Step 1: Mentee Requests a Mentor
**Action**: Mentee finds a mentor and sends a mentorship request

**Form Requirements**:
- Mentor ID
- Scheduled date/time
- Notes (optional)

**Backend**:
```javascript
POST /mentee/session/request
{
  mentorId: "mentor_id",
  scheduledAt: "2024-11-15T10:00:00",
  notes: "Looking forward to learning about web development"
}
```

**What Happens**:
- Creates a `Session` document:
  ```javascript
  {
    mentee: mentee_id,
    mentor: mentor_id,
    organization: null,  // No organization
    status: 'pending',
    scheduledAt: date,
    notes: text
  }
  ```

### Step 2: Mentor Sees Request
**Where**: `/mentor/dashboard`

**What Shows**:
- All sessions where `mentor: their_id` AND `status: 'pending'`
- Displays mentee name, date, time, notes

**Actions Available**:
- **Accept**: `POST /mentor/session/:id/accept` → Changes status to 'accepted'
- **Reject**: `POST /mentor/session/:id/reject` → Changes status to 'cancelled'

### Step 3: Session Status Updates
Once accepted:
- Mentee sees session in their sessions page with status 'accepted'
- Mentor can mark as completed: `POST /mentor/session/:id/complete`
- Session appears in analytics for both parties

---

## Flow 2: Organization-Managed Mentorship (Mentee → Organization)

### Step 1: Mentee Joins Organization
**Action**: Mentee requests to join an organization's mentorship program

**Form Requirements**:
- Organization ID
- Mentor ID (optional - can be assigned later by org)
- Scheduled date/time
- Notes (optional)

**Backend**:
```javascript
POST /mentee/session/organization/request
{
  organizationId: "org_id",
  mentorId: "mentor_id",  // Optional
  scheduledAt: "2024-11-15T10:00:00",
  notes: "Interested in joining your mentorship program"
}
```

**What Happens**:
- Creates a `Session` document:
  ```javascript
  {
    mentee: mentee_id,
    mentor: mentor_id || null,
    organization: organization_id,  // Organization is set
    status: 'pending',
    scheduledAt: date,
    notes: text
  }
  ```

### Step 2: Organization Sees Request
**Where**: `/org/dashboard`

**What Shows**:
- All sessions where `organization: their_id` AND `status: 'pending'`
- Displays mentee name, mentor name (if assigned), date, time, notes

**Actions Available**:
- **Approve**: `POST /org/session/:id/accept` → Changes status to 'accepted'
- Organization can mark as completed: `POST /org/session/:id/complete`

### Step 3: Session Status Updates
Once approved by organization:
- Mentee sees session in their sessions page with status 'accepted'
- Session includes organization information
- Mentor (if assigned) sees the session in their dashboard
- Session appears in organization analytics

---

## Key Differences Between Flows

| Aspect | Direct Mentorship | Organization-Managed |
|--------|------------------|---------------------|
| **Request Route** | `/mentee/session/request` | `/mentee/session/organization/request` |
| **Approval By** | Mentor | Organization |
| **Session Fields** | mentee + mentor | mentee + mentor + organization |
| **Dashboard Shows** | Mentor dashboard | Organization dashboard |
| **Mentor Role** | Direct relationship | Optional/assigned by org |

---

## Database Schema

### Session Model
```javascript
{
  mentor: ObjectId,        // Reference to Mentor (optional for org flow)
  mentee: ObjectId,        // Reference to Mentee (required)
  organization: ObjectId,  // Reference to Organization (optional, only for org flow)
  scheduledAt: Date,       // When session is scheduled
  status: String,          // 'pending', 'accepted', 'completed', 'cancelled'
  notes: String,           // Additional information
  createdAt: Date          // When request was created
}
```

### Status Flow
```
pending → accepted → completed
    ↓
cancelled
```

---

## Implementation Checklist

### ✅ Backend (Complete)
- [x] `menteeController.requestSession` - Direct mentor requests
- [x] `menteeController.requestOrganizationSession` - Organization requests
- [x] `mentorController.dashboard` - Shows pending direct sessions
- [x] `mentorController.acceptSession` - Accept direct sessions
- [x] `mentorController.rejectSession` - Reject direct sessions
- [x] `orgController.dashboard` - Shows pending org sessions
- [x] `orgController.acceptSession` - Accept org sessions
- [x] Routes configured for both flows
- [x] Session model supports both flows
- [x] Population of mentor, mentee, and organization data

### 📝 Frontend (To Do)
- [ ] Mentee dashboard: Add form for requesting direct mentor sessions
- [ ] Mentee dashboard: Add form for requesting organization membership
- [ ] Mentor dashboard: Display pending requests (already shows)
- [ ] Organization dashboard: Display pending requests (already shows)
- [ ] Sessions page: Show organization info when present

---

## Testing the Flow

### Test Direct Mentorship:
1. Log in as mentee
2. Go to dashboard, find a mentor
3. Request session with mentor
4. Log out, log in as that mentor
5. Go to mentor dashboard
6. See pending request
7. Click "Accept"
8. Verify status changes to 'accepted'

### Test Organization Mentorship:
1. Log in as mentee
2. Go to dashboard, find an organization
3. Request to join organization (with or without mentor)
4. Log out, log in as organization
5. Go to organization dashboard
6. See pending request
7. Click "Approve"
8. Verify status changes to 'accepted'

---

## API Endpoints Summary

### Mentee Endpoints
- `POST /mentee/session/request` - Request direct mentor session
- `POST /mentee/session/organization/request` - Request organization session
- `GET /mentee/sessions` - View all sessions
- `POST /mentee/session/:id/cancel` - Cancel session

### Mentor Endpoints
- `GET /mentor/dashboard` - View pending sessions
- `POST /mentor/session/:id/accept` - Accept session
- `POST /mentor/session/:id/reject` - Reject session
- `POST /mentor/session/:id/complete` - Mark as completed
- `GET /mentor/sessions` - View all sessions

### Organization Endpoints
- `GET /org/dashboard` - View pending sessions
- `POST /org/session/:id/accept` - Approve session
- `POST /org/session/:id/complete` - Mark as completed
- `GET /org/sessions` - View all sessions

---

## Notes
- Mentors and organizations operate independently
- A session can have EITHER a mentor alone OR organization + mentor
- Organization field being present indicates org-managed mentorship
- All sessions require mentee and scheduledAt
- Status transitions are one-way (can't un-accept)
