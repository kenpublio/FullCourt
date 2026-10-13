import { Link, Navigate, useParams } from 'react-router-dom';
import { CourtNav, CourtFooter } from '../components/PublicCourt';

const contact = 'fullcourt2026@gmail.com';
const pages = {
  privacy: {
    icon:'bi-shield-lock', title:'Privacy Policy', intro:'How FullCourt collects, uses, protects, and removes tournament information.',
    sections:[
      ['Information we handle','Account and contact details; birth date and age; address; player position and height; team, roster, eligibility and game records; photos and uploaded documents; payment references; device and security logs.'],
      ['Why we use it','To create accounts, validate age and division eligibility, manage competitions, publish approved schedules and statistics, prevent fraud, deliver reminders, and protect the platform.'],
      ['Public and restricted data','Schedules, team names, scores, standings, and approved awards may be public. Contact details, passwords, receipts, eligibility documents, and exact birth dates are restricted to the account owner and authorized personnel.'],
      ['Children and youth players','A parent or legal guardian should approve registration and document submission for minors. Organizers must collect only the records required for eligibility and must avoid publishing a minor’s contact details, exact birth date, or private documents.'],
      ['Sharing and storage','Data may be processed by hosting, database, email, and payment providers needed to operate FullCourt. We do not sell personal data. Access is limited by account role. Records are retained only while needed for operations, audit, dispute handling, or legal duties.'],
      ['Cookies and device storage','FullCourt uses essential browser storage to keep users signed in, remember appearance and accessibility preferences, secure one-device scoring sessions, and queue permitted offline game actions. FullCourt does not use advertising cookies or cross-site behavioral tracking. Clearing site data signs the user out and removes saved device preferences.'],
      ['Accessibility and assistance','We aim to provide keyboard access, visible focus, readable contrast, clear labels and errors, responsive layouts, browser zoom, and screen-reader support. Contact FullCourt if a bracket, scoreboard, chart, or document requires an accessible text or table alternative.'],
      ['Your choices','You may request access, correction, export, restriction, or deletion of eligible personal information. Some official results and audit records may be retained when needed to preserve tournament integrity.'],
    ]
  },
  terms: {
    icon:'bi-file-earmark-text', title:'Terms of Use', intro:'Rules for using FullCourt fairly and safely.',
    sections:[
      ['Account responsibility','Provide accurate information, protect your password and verification codes, and use only the role assigned to you. Tell us promptly if an account may be compromised.'],
      ['Tournament authority','Organizers remain responsible for competition rules, eligibility decisions, fees, schedules, officials, safety, and dispute procedures. FullCourt records and displays their authorized decisions.'],
      ['Acceptable use','Do not impersonate another person, alter receipts, submit false eligibility records, manipulate scores, harass participants, scrape private data, bypass security, or disrupt games and services.'],
      ['Scores and analytics','Live scores may be corrected by authorized officials. Statistics, rankings, Mythical Five recommendations, and win probability are informational estimates; they are not betting advice or a guarantee of results.'],
      ['Content and suspension','You must have permission to upload logos, photos, documents, and announcements. Accounts or content may be restricted for fraud, abuse, infringement, security threats, or violation of tournament rules.'],
      ['Corrections, claims and reports','Score or eligibility disputes must first be submitted to the tournament Admin with the relevant competition, game or player, date, disputed entry, and supporting evidence. Fraud, harassment, exposed personal data, security issues, and ownership claims should be reported immediately. Only authorized personnel may change official records, and decisions must be preserved in the audit trail.'],
      ['Responsible and safe operation','Automated age flags, analytics, rankings, and award recommendations only support human review. The Admin remains responsible for eligibility, officiating, medical and disciplinary decisions, safe venues, youth safeguards, fair rules, tie-breakers, correction procedures, and emergency response.'],
      ['Service limits','Availability may be affected by internet, devices, maintenance, or third-party providers. Verify crucial schedules and official rulings with the organizer.'],
    ]
  }
};

export default function LegalPage(){
  const { document } = useParams();
  if (!pages[document]) return <Navigate replace to={['cookies','accessibility'].includes(document)?'/legal/privacy':'/legal/terms'}/>;
  const page = pages[document] || pages.privacy;
  return <div className="court-site legal-site"><CourtNav/><main className="court-container legal-main">
    <Link to="/" className="legal-back"><i className="bi bi-arrow-left"/> Back to FullCourt</Link>
    <header className="legal-hero"><span><i className={`bi ${page.icon}`}/></span><div><small>FULLCOURT · TRUST CENTER</small><h1>{page.title}</h1><p>{page.intro}</p><em>Effective October 13, 2026</em></div></header>
    <div className="legal-layout"><aside>{Object.entries(pages).map(([key,item])=><Link className={key===document?'active':''} to={`/legal/${key}`} key={key}><i className={`bi ${item.icon}`}/>{item.title}</Link>)}</aside>
    <article>{page.sections.map(([title,body],index)=><section key={title}><span>{String(index+1).padStart(2,'0')}</span><div><h2>{title}</h2><p>{body}</p></div></section>)}
      <div className="legal-contact"><i className="bi bi-envelope-check"/><div><h2>Contact FullCourt</h2><p>For privacy requests, accessibility help, corrections, claims, or safety reports, email <a href={`mailto:${contact}`}>{contact}</a>. Include enough detail to locate the record, but never send your password or verification code.</p></div></div>
    </article></div>
  </main><CourtFooter/></div>;
}
