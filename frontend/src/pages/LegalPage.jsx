import { Link, useParams } from 'react-router-dom';
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
      ['Sharing and storage','Data may be processed by hosting, database, email, SMS, and payment providers needed to operate FullCourt. We do not sell personal data. Access is limited by account role. Records are retained only while needed for operations, audit, dispute handling, or legal duties.'],
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
      ['Service limits','Availability may be affected by internet, devices, maintenance, or third-party providers. Verify crucial schedules and official rulings with the organizer.'],
    ]
  },
  cookies: {
    icon:'bi-cookie', title:'Cookie & Local Storage Notice', intro:'What FullCourt saves in your browser and why.',
    sections:[
      ['Essential storage','FullCourt uses browser storage to keep you signed in securely, remember your role, retain accessibility or appearance choices, and prevent repeated setup. These items are needed for requested features.'],
      ['Analytics and advertising','The current FullCourt build does not use advertising cookies or cross-site behavioral tracking. If optional analytics are added later, this notice and the consent controls must be updated before activation.'],
      ['Your control','You can sign out and clear site data in your browser. Removing essential storage signs you out and resets saved preferences. Browser privacy settings may also block storage.'],
    ]
  },
  accessibility: {
    icon:'bi-universal-access', title:'Accessibility Statement', intro:'Our commitment to making basketball information usable by everyone.',
    sections:[
      ['Our target','We aim for keyboard access, visible focus, readable contrast, text alternatives for meaningful images, clear labels and errors, responsive layouts, and support for browser zoom and screen readers.'],
      ['Known limitations','Complex brackets, live scoreboards, generated charts, and third-party documents may need further improvement for some assistive technologies. Important information should also be available in a simple text or table format.'],
      ['Request assistance','Report the page, device, browser, assistive technology, and difficulty encountered. We will provide an accessible alternative when reasonably possible and prioritize a correction.'],
    ]
  },
  claims: {
    icon:'bi-flag', title:'Claims, Corrections & Reporting', intro:'How to report inaccurate records, unsafe content, fraud, or ownership concerns.',
    sections:[
      ['Score and eligibility disputes','Contact the tournament organizer first and include the competition, game or player, date, disputed entry, and supporting evidence. Only authorized officials may change official records.'],
      ['Fraud, safety and privacy','Report edited receipts, false identity or age documents, account misuse, harassment, exposed private data, or security concerns immediately. Do not include passwords or verification codes in a report.'],
      ['Photo, logo and copyright claims','Identify the content and page, explain your ownership or authority, provide contact details and evidence, and state the action requested. Content may be temporarily restricted while the claim is reviewed.'],
      ['Review process','Reports are acknowledged, preserved for audit, sent to the responsible administrator, and resolved according to evidence and tournament rules. Urgent safety or account-security reports receive priority.'],
    ]
  },
  responsible: {
    icon:'bi-heart-pulse', title:'Responsible Use & Safety', intro:'How organizers and participants should use FullCourt responsibly.',
    sections:[
      ['Human decisions remain essential','Age checks, analytics, rankings, and recommendations support organizers and officials. Qualified people must review eligibility, officiating, medical, disciplinary, and award decisions.'],
      ['Data minimization','Collect only what a competition needs. Limit access to receipts, identity records, birth dates, addresses, and medical or guardian documents. Remove unnecessary copies after the retention period.'],
      ['Fair competition','Publish clear rules, correction procedures, tie-breakers, selection formulas, and analytics limitations. Record changes in an audit trail and avoid using private or irrelevant traits to rank players.'],
      ['Player welfare','Competition management does not replace medical advice or emergency procedures. Organizers remain responsible for safe venues, appropriate scheduling, youth safeguards, and qualified officials.'],
      ['Security practice','Use strong unique passwords, role-based access, verified sender services, protected database rules, backups, timely updates, and incident response before production deployment.'],
    ]
  }
};

export default function LegalPage(){
  const { document } = useParams();
  const page = pages[document] || pages.privacy;
  return <div className="court-site legal-site"><CourtNav/><main className="court-container legal-main">
    <Link to="/" className="legal-back"><i className="bi bi-arrow-left"/> Back to FullCourt</Link>
    <header className="legal-hero"><span><i className={`bi ${page.icon}`}/></span><div><small>FULLCOURT · TRUST CENTER</small><h1>{page.title}</h1><p>{page.intro}</p><em>Effective September 8, 2026</em></div></header>
    <div className="legal-layout"><aside>{Object.entries(pages).map(([key,item])=><Link className={key===document?'active':''} to={`/legal/${key}`} key={key}><i className={`bi ${item.icon}`}/>{item.title}</Link>)}</aside>
    <article>{page.sections.map(([title,body],index)=><section key={title}><span>{String(index+1).padStart(2,'0')}</span><div><h2>{title}</h2><p>{body}</p></div></section>)}
      <div className="legal-contact"><i className="bi bi-envelope-check"/><div><h2>Contact FullCourt</h2><p>For privacy requests, accessibility help, corrections, claims, or safety reports, email <a href={`mailto:${contact}`}>{contact}</a>. Include enough detail to locate the record, but never send your password or verification code.</p></div></div>
    </article></div>
  </main><CourtFooter/></div>;
}
