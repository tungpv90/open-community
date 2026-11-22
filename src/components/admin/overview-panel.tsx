'use client';

import Link from 'next/link';

import { AdminPage, PageHeading } from '@/components/admin/admin-data';

export function OverviewPanel() {
  return (
    <AdminPage>
      {(data) => {
        const openReports = data.reports.filter(
          (report) => !report.status || report.status === 'open',
        ).length;
        const unconfirmed = data.users.filter((user) => !user.email_confirmed_at).length;
        return (
          <>
            <PageHeading
              eyebrow="Overview"
              title="Community at a glance"
              copy="Monitor activity, membership, and moderation from one place."
            />
            <section className="admin-stats">
              <div>
                <span>Members</span>
                <strong>{data.users.length}</strong>
                <small>
                  {unconfirmed ? `${unconfirmed} awaiting confirmation` : 'All confirmed'}
                </small>
              </div>
              <div>
                <span>Discussions</span>
                <strong>{data.discussion_count}</strong>
                <small>Community topics</small>
              </div>
              <div>
                <span>Posts</span>
                <strong>{data.post_count}</strong>
                <small>Replies and starters</small>
              </div>
              <div>
                <span>Open reports</span>
                <strong>{openReports}</strong>
                <small>{openReports ? 'Needs attention' : 'Queue is clear'}</small>
              </div>
            </section>
            <section className="admin-grid-two">
              <div className="admin-card">
                <h2>Quick actions</h2>
                <div className="quick-links">
                  <Link href="/admin/users">
                    Manage users<span>Roles, status, confirmation</span>
                  </Link>
                  <Link href="/admin/discussions">
                    Review discussions<span>Edit or remove community content</span>
                  </Link>
                  <Link href="/admin/settings">
                    Community settings<span>Title, welcome message, registration</span>
                  </Link>
                  <Link href="/admin/header">
                    Header menu<span>Brand, navigation links</span>
                  </Link>
                </div>
              </div>
              <div className="admin-card">
                <h2>Community health</h2>
                <div className="health-list">
                  <p>
                    <i className="good" />
                    Forum database<span>Connected</span>
                  </p>
                  <p>
                    <i className={unconfirmed ? 'warn' : 'good'} />
                    Email confirmation
                    <span>{unconfirmed ? `${unconfirmed} pending` : 'Clear'}</span>
                  </p>
                  <p>
                    <i className={openReports ? 'warn' : 'good'} />
                    Moderation queue<span>{openReports ? `${openReports} pending` : 'Clear'}</span>
                  </p>
                  <p>
                    <i className={data.categories.length ? 'good' : 'warn'} />
                    Categories
                    <span>
                      {data.categories.length
                        ? `${data.categories.length} configured`
                        : 'Create one to allow new discussions'}
                    </span>
                  </p>
                  <p>
                    <i className="good" />
                    Tags<span>{data.tags.length} configured</span>
                  </p>
                </div>
              </div>
            </section>
          </>
        );
      }}
    </AdminPage>
  );
}
