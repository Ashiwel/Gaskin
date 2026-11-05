import { useEffect, useState } from 'react';
import { auditLog, useAIStatus, type AuditRow } from './ai';
import { fmtDateTime } from './format';
import { IShield } from './icons';

export function About() {
  const status = useAIStatus();
  const [rows, setRows] = useState<AuditRow[]>(() => auditLog());
  useEffect(() => {
    const t = window.setInterval(() => setRows(auditLog()), 2000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="page narrow">
      <header className="today-head">
        <h1 className="t-display">About Gaskin</h1>
        <p className="lede">
          An open-source continuity-of-care planner for midwives and community health workers in Nigeria, Kenya and Ghana, from conception to a child’s first 1,000 days. Named for Ina May Gaskin, the midwife who taught the world to trust women’s bodies.
        </p>
      </header>

      <p className="note amber">
        <IShield />
        <span>
          <strong>Synthetic data only.</strong> Every mother, worker and facility in this demo is invented. No real patient data is used or stored.
        </span>
      </p>

      <div className="prose">
        <h3>Open source</h3>
        <p>
          The code is released under the GNU Affero General Public License, version 3 (AGPL-3.0), so ministries, NGOs and clinics can run, change and share it freely, and anyone who offers a changed version as a service must publish their changes too. Clinical content, illustrations, language packs and the traditional practices library are released under Creative Commons Attribution 4.0 (CC BY 4.0). Third-party code keeps its own licence (lucide-react under ISC, adapted Animata components under MIT); see THIRD_PARTY_NOTICES.md. Anyone can propose corrections through the expert review process.
        </p>

        <h3>Data protection</h3>
        <p>
          Gaskin records consent before anything is stored or sent, separately for keeping records and for receiving messages, with a guardian involved for adolescents. It is designed to meet the Nigeria Data Protection Act 2023, Kenya’s Data Protection Act 2019 and Ghana’s Data Protection Act 2012 (Act 843). Records stay on the worker’s device or the programme’s own server. Each mother has a Gaskin ID that does not depend on her phone number, so her record survives a SIM change. Public figures are aggregated and de-identified, and small counts are suppressed.
        </p>

        <h3>AI safety principles</h3>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
          <li>Safety comes from rules, not AI. Danger alerts and locked items are decided by guideline rules that anyone can read.</li>
          <li>Gaskin works fully with no AI at all.</li>
          <li>Personal details are removed before any text reaches an AI service, and you can see exactly what is sent.</li>
          <li>Every AI message is checked for doses, diagnoses and missing danger signs, and a person approves it before sending.</li>
          <li>Changes to the rules are reviewed by clinicians and released on a schedule. Gaskin never retrains itself live.</li>
        </ul>
      </div>

      <section className="section">
        <div className="section-head">
          <h2 className="t-h2">AI audit log</h2>
          <span className="small muted">Now using: {status.label}</span>
        </div>
        <p className="small soft">Every time this device asks an AI for help, it is logged here: what for, which service, what kind of data, and how much.</p>
        {rows.length === 0 ? (
          <p className="soft">No AI requests yet on this device.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Task</th>
                  <th>Service</th>
                  <th>Data shared</th>
                  <th style={{ textAlign: 'right' }}>Size</th>
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((r, i) => (
                  <tr key={i}>
                    <td>{fmtDateTime(r.at)}</td>
                    <td>{r.task}</td>
                    <td>{r.provider}</td>
                    <td>{r.categories.join(', ') || 'Plan text only'}</td>
                    <td className="n">{r.size ? `${r.size.toLocaleString('en-GB')} chars` : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="small muted">Prototype for the UNICEF Venture Fund FemTech call, November 2026. Built for and with midwives.</p>
    </div>
  );
}
