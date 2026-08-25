import {
  ArrowRight,
  Asterisk,
  CaretDown,
  Check,
  CheckCircle,
  CircleNotch,
  Clock,
  Copy,
  GithubLogo,
  List,
  MagnifyingGlass,
  Pulse,
  ShieldCheck,
  SlidersHorizontal,
  TerminalWindow,
  TestTube,
  X,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";

const navItems = [
  ["Platform", "/product"],
  ["Solutions", "/#workflow"],
  ["Pricing", "/pricing"],
  ["Docs", "/product#docs"],
  ["Resources", "/#proof"],
];

const traceSteps = [
  { type: "Input", label: "Refund request", duration: "2.3s" },
  { type: "Plan", label: "Resolve policy path", duration: "1.1s" },
  { type: "Tool", label: "Orders service", duration: "0.8s" },
  { type: "Policy", label: "Refund guardrail", duration: "0.9s" },
  { type: "Tool", label: "Payments API", duration: "2.6s" },
  { type: "Output", label: "Customer response", duration: "0.4s" },
];

function Brand() {
  return (
    <a className="brand" href="/" aria-label="Kern home">
      <Asterisk weight="bold" aria-hidden="true" />
      <span>Kern</span>
    </a>
  );
}

function ButtonLink({ href, children, variant = "primary" }) {
  return (
    <a className={`button button-${variant}`} href={href}>
      <span>{children}</span>
      <ArrowRight weight="bold" aria-hidden="true" />
    </a>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        <nav className={open ? "nav open" : "nav"} aria-label="Primary navigation">
          {navItems.map(([label, href]) => (
            <a href={href} key={label} onClick={() => setOpen(false)}>{label}</a>
          ))}
        </nav>
        <div className="header-actions">
          <a className="sign-in" href="/product#demo">Sign in</a>
          <ButtonLink href="/#demo">Open the playbook</ButtonLink>
          <button className="menu-button" type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            {open ? <X /> : <List />}
          </button>
        </div>
      </div>
    </header>
  );
}

function RailLabel({ index, children }) {
  return <div className="rail-label" aria-hidden="true"><span>{String(index).padStart(2, "0")}</span><small>{children}</small></div>;
}

function TracePanel({ compact = false }) {
  const [active, setActive] = useState(4);
  const step = traceSteps[active];
  return (
    <div className={`trace-panel ${compact ? "trace-compact" : ""}`}>
      <div className="panel-topbar"><span>Trace · Customer Refund Flow</span><div className="panel-status"><CheckCircle weight="fill" /> Completed</div></div>
      <div className="trace-body">
        <div className="trace-list" role="group" aria-label="Agent trace steps">
          {traceSteps.map((item, index) => (
            <button type="button" className={index === active ? "trace-step active" : "trace-step"} key={`${item.type}-${item.label}`} onClick={() => setActive(index)} aria-pressed={index === active}>
              <span className="step-index">{index + 1}</span>
              <span><small>{item.type}</small>{item.label}</span>
              <time>{item.duration}</time>
            </button>
          ))}
        </div>
        {!compact && (
          <div className="trace-detail">
            <div className="detail-tabs"><b>Details</b><span>Input</span><span>Output</span></div>
            <p className="code-label">{step.type} · {step.label}</p>
            <pre>{`POST /agent/run\n{\n  \"trace\": \"krn_81f3\",\n  \"policy\": \"refund-v3\",\n  \"status\": \"passed\"\n}`}</pre>
            <dl className="detail-meta"><div><dt>Duration</dt><dd>{step.duration}</dd></div><div><dt>Confidence</dt><dd>98.2%</dd></div><div><dt>Cost</dt><dd>$0.014</dd></div></dl>
          </div>
        )}
      </div>
    </div>
  );
}

function WorkflowStrip() {
  const items = [[Pulse, "Instrument", "Capture every step"], [TestTube, "Evaluate", "Test real scenarios"], [MagnifyingGlass, "Analyze", "Find failure patterns"], [SlidersHorizontal, "Improve", "Refine with evidence"], [ShieldCheck, "Monitor", "Catch regressions"]];
  return <div className="workflow-strip">{items.map(([Icon, title, copy], index) => <div className="workflow-step" key={title}><span className="workflow-number">{index + 1}</span><Icon aria-hidden="true" /><b>{title}</b><small>{copy}</small></div>)}</div>;
}

function FailurePanel() {
  return (
    <div className="failure-panel">
      <div className="failure-map" role="img" aria-label="Failure path visualization">
        <div className="map-row"><CheckCircle /><span>User request</span></div>
        <div className="map-row indent"><CheckCircle /><span>Policy lookup</span></div>
        <div className="map-row indent-two failed"><X /><span>Payments timeout</span></div>
        <div className="map-row indent"><CircleNotch /><span>Fallback path</span></div>
      </div>
      <div className="case-file">
        <div className="case-title"><span>Case · Payments API timeout</span><b>Failed</b></div>
        <dl><div><dt>Impact</dt><dd>23.4% of runs</dd></div><div><dt>First seen</dt><dd>May 10, 10:12</dd></div><div><dt>Root cause</dt><dd>Latency above 1.2s</dd></div></dl>
        <div className="bars" role="img" aria-label="Failure volume over five days">{[34, 58, 47, 72, 91].map((height, index) => <i key={height} style={{ height: `${height}%` }} className={index === 4 ? "hot" : ""} />)}</div>
      </div>
    </div>
  );
}

function CollaborationPanel() {
  const comments = [["Mina Lee", "The policy check is returning a deprecated field."], ["Arjun Patel", "Updated the tool schema and added a regression test."], ["Taylor Nguyen", "Reran the suite. All green."]];
  return (
    <div className="collaboration-grid">
      <div className="comments-panel">
        <div className="panel-topbar"><span>Trace · Customer onboarding</span><div className="panel-status"><CheckCircle weight="fill" /> Completed</div></div>
        {comments.map(([name, comment]) => <div className="comment" key={name}><span className="avatar">{name.split(" ").map((part) => part[0]).join("")}</span><div><b>{name}</b><p>{comment}</p></div></div>)}
        <button type="button" className="comment-field">Add a comment… <ArrowRight /></button>
      </div>
      <div className="runs-panel">
        <div className="panel-topbar"><span>Runs this week</span><span>Live</span></div><div className="run-stat"><b>12,842</b><span>+10.8%</span></div>
        <dl><div><dt>Payments API timeout</dt><dd>23.4%</dd></div><div><dt>Policy service schema</dt><dd>15.1%</dd></div><div><dt>Tool not found</dt><dd>9.6%</dd></div><div><dt>Guardrail violation</dt><dd>6.0%</dd></div></dl>
      </div>
    </div>
  );
}

const plans = [
  { name: "Starter", monthly: 0, annual: 0, note: "For individuals and small teams.", features: ["1,000 runs", "Trace and replay", "Community support"] },
  { name: "Pro", monthly: 49, annual: 39, note: "For growing engineering teams.", featured: true, features: ["Unlimited traces", "Advanced evaluations", "Team collaboration", "Slack and email support"] },
  { name: "Enterprise", monthly: null, annual: null, note: "For teams with advanced needs.", features: ["SAML SSO and SCIM", "Audit logs", "Private deployment", "Dedicated support"] },
];

function PricingCards({ compact = false }) {
  const [annual, setAnnual] = useState(true);
  const PlanHeading = compact ? "h3" : "h2";
  return (
    <div className="pricing-wrap">
      {!compact && <div className="billing-toggle" role="group" aria-label="Billing period"><button type="button" className={!annual ? "active" : ""} onClick={() => setAnnual(false)}>Monthly</button><button type="button" className={annual ? "active" : ""} onClick={() => setAnnual(true)}>Annual · save 20%</button></div>}
      <div className="pricing-cards">{plans.map((plan) => { const amount = annual ? plan.annual : plan.monthly; return (
        <article className={plan.featured ? "price-card featured" : "price-card"} key={plan.name}>
          {plan.featured && <span className="popular">Most popular</span>}<PlanHeading>{plan.name}</PlanHeading><p>{plan.note}</p><div className="price">{amount === null ? "Custom" : `$${amount}`} {amount !== null && <small>/ seat / mo</small>}</div>
          <ul>{plan.features.slice(0, compact ? 3 : 4).map((feature) => <li key={feature}><Check /> {feature}</li>)}</ul><ButtonLink href="/product#demo" variant={plan.featured ? "primary" : "outline"}>{plan.name === "Enterprise" ? "Talk to sales" : "Get started"}</ButtonLink>
        </article>); })}</div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-lead"><Brand /><p>The agent reliability platform for technical teams.</p></div>
      <div><b>Platform</b><a href="/product">Tracing</a><a href="/product#evaluations">Evaluations</a><a href="/product#monitoring">Monitoring</a></div>
      <div><b>Resources</b><a href="/product#docs">Documentation</a><a href="/#proof">Customer stories</a><a href="/pricing">Pricing</a></div>
      <div><b>Company</b><a href="/#proof">About</a><a href="mailto:hello@kern.example">Contact</a><a href="/product#security">Security</a></div>
      <div className="footer-demo"><span>See Kern in action</span><ButtonLink href="/product#demo" variant="light">Book a demo</ButtonLink></div>
      <div className="footer-bottom"><small>© 2026 Kern Labs. Fictional demonstration brand.</small><div><GithubLogo aria-hidden="true" /><a href="/product#security">Privacy</a><a href="/product#security">Terms</a></div></div>
    </footer>
  );
}

function HomePage() {
  return (
    <><Header /><main>
      <section className="hero numbered-section" id="demo"><RailLabel index={1}>Field manual</RailLabel><div className="hero-copy reveal"><h1>Reliable agents are built, not hoped for.</h1><p>Kern helps technical teams trace, test, and ship dependable agents with confidence.</p><div className="hero-actions"><ButtonLink href="/product">Open the playbook</ButtonLink><a className="text-link" href="#workflow">See Kern in action <ArrowRight /></a></div><div className="hero-points"><span><Pulse /> Trace everything</span><span><TestTube /> Test rigorously</span><span><ShieldCheck /> Ship confidently</span></div></div><div className="hero-product reveal delay-one"><TracePanel /></div></section>
      <section className="numbered-section workflow-section" id="workflow"><RailLabel index={2}>Reliability workflow</RailLabel><WorkflowStrip /></section>
      <section className="numbered-section split-section"><RailLabel index={3}>Failure analysis</RailLabel><div className="section-copy"><h2>Find the failure.<br />Fix the cause.</h2><p>Kern surfaces the why behind every failure so your team can fix issues at the source.</p><ul className="check-list"><li><Check /> Cluster failures by root cause</li><li><Check /> Replay any trace step by step</li><li><Check /> Compare versions and guardrails</li><li><Check /> Export evidence for audits</li></ul></div><FailurePanel /></section>
      <section className="numbered-section split-section collaboration-section"><RailLabel index={4}>Team collaboration</RailLabel><div className="section-copy"><h2>Built for how engineering teams actually work.</h2><p>Share traces, align on fixes, and ship reliable agents together.</p></div><CollaborationPanel /></section>
      <section className="numbered-section metrics-section"><RailLabel index={5}>Proof</RailLabel>{[["87%", "fewer production failures"], ["2.4×", "faster issue resolution"], ["< 3 hr", "time to first trace"], ["99.95%", "platform uptime"]].map(([value, label]) => <div className="metric" key={label}><b>{value}</b><span>{label}</span></div>)}</section>
      <section className="numbered-section quote-section" id="proof"><RailLabel index={6}>Trusted by technical leaders</RailLabel><blockquote>“Kern changed how we ship AI. We went from crossing our fingers to knowing exactly what our agents will do in production.”<cite>Priya Shah · Head of Platform, Tern Systems</cite></blockquote><div className="logo-grid" role="list" aria-label="Fictional customer names"><span role="listitem">Tern Systems</span><span role="listitem">Northstar Labs</span><span role="listitem">Relayforge</span><span role="listitem">Latticeworks</span><span role="listitem">Anvil Cloud</span><span role="listitem">Fieldnote AI</span></div></section>
      <section className="numbered-section pricing-section"><RailLabel index={7}>Pricing</RailLabel><div className="section-copy"><h2>Simple pricing that scales with you.</h2><p>Start free. Scale when you are ready.</p><a className="text-link" href="/pricing">View full pricing <ArrowRight /></a></div><PricingCards compact /></section>
      <section className="numbered-section final-cta"><RailLabel index={8}>Get started</RailLabel><h2>Ship AI agents you can count on.</h2><p>Everything you need to build, test, and ship reliable agents.</p><ButtonLink href="/product#demo">Open the playbook</ButtonLink><div className="terminal-card"><div><TerminalWindow /> kern init</div><pre>$ npm install @kern/agents\n$ kern login\n$ kern init\n\n✓ Connected\n✓ Project initialized\n✓ Start tracing</pre><button type="button" onClick={() => navigator.clipboard?.writeText("npm install @kern/agents")} aria-label="Copy install command"><Copy /></button></div></section>
    </main><Footer /></>
  );
}

function ProductPage() {
  const [copied, setCopied] = useState(false);
  return (
    <><Header /><main className="inner-page">
      <section className="product-hero" id="demo"><span className="kicker">Agent reliability platform</span><h1>One record for every agent decision.</h1><p>Trace complete runs, evaluate behavior against real scenarios, and stop regressions before they reach production.</p><div className="hero-actions"><ButtonLink href="#evaluations">Explore the platform</ButtonLink><ButtonLink href="/pricing" variant="outline">View pricing</ButtonLink></div><TracePanel /></section>
      <section className="product-story" id="evaluations"><div><span className="kicker">Evaluation workspace</span><h2>Test behavior, not just outputs.</h2><p>Build reusable suites from production traces, edge cases, and policy requirements.</p></div><div className="eval-board"><div className="eval-head"><b>Refund assistant · Release 24</b><span>1,250 runs</span></div>{[["Correctness", 98], ["Groundedness", 94], ["Tool accuracy", 91], ["Safety", 100]].map(([label, score]) => <div className="eval-row" key={label}><span>{label}</span><div><i style={{ width: `${score}%` }} /></div><b>{score}%</b></div>)}</div></section>
      <section className="product-story reverse" id="monitoring"><div><span className="kicker">Production monitoring</span><h2>Know before reliability slips.</h2><p>Track model, prompt, tool, latency, and policy changes in one operational view.</p></div><FailurePanel /></section>
      <section className="sdk-section" id="docs"><div><span className="kicker">Kern SDK</span><h2>Three lines to your first trace.</h2><p>Works with your models, orchestration stack, and deployment environment.</p></div><div className="terminal-card light-terminal"><pre>{`import { kern } from "@kern/agents";

const run = kern.trace(agent);
await run.invoke(input);`}</pre><button type="button" onClick={() => { navigator.clipboard?.writeText("npm install @kern/agents"); setCopied(true); }} aria-label="Copy SDK install command">{copied ? <Check /> : <Copy />}</button></div></section>
      <section className="security-band" id="security"><ShieldCheck /><div><h2>Evidence for every review.</h2><p>Role-based access, audit logs, configurable retention, and private deployment options.</p></div><ButtonLink href="mailto:security@kern.example" variant="light">Security brief</ButtonLink></section>
    </main><Footer /></>
  );
}

function PricingPage() {
  const [openFaq, setOpenFaq] = useState(0);
  const faqs = useMemo(() => [["What counts as a run?", "A run is one complete agent invocation, including model calls, tool calls, policy checks, and the final response."], ["Can we keep data in our region?", "Yes. Enterprise plans include regional storage controls and private deployment options."], ["Do you support custom evaluations?", "Yes. Define evaluation logic with datasets, rules, model judges, or your own endpoints."], ["Can we start with production traces?", "Yes. Import selected traces into an evaluation suite, redact sensitive fields, then replay safely."]], []);
  return (
    <><Header /><main className="inner-page pricing-page">
      <section className="pricing-hero"><span className="kicker">Simple pricing</span><h1>Start with one agent.<br />Scale with confidence.</h1><p>Every plan includes complete tracing, collaborative debugging, and the core evaluation workflow.</p></section>
      <PricingCards />
      <section className="comparison-section" tabIndex="0" aria-label="Scrollable plan comparison"><h2>Everything required to ship reliably.</h2><div className="comparison-table" role="table" aria-label="Plan comparison"><div role="row" className="table-head"><b role="columnheader">Capability</b><b role="columnheader">Starter</b><b role="columnheader">Pro</b><b role="columnheader">Enterprise</b></div>{["Complete traces", "Evaluation suites", "Team comments", "Policy guardrails", "Audit logs", "Private deployment"].map((feature, index) => <div role="row" key={feature}><span role="cell">{feature}</span><span role="cell">{index < 2 ? <Check /> : "Not included"}</span><span role="cell">{index < 4 ? <Check /> : "Not included"}</span><span role="cell"><Check /></span></div>)}</div></section>
      <section className="faq-section"><div><span className="kicker">Questions</span><h2>Clear answers before you commit.</h2></div><div className="faq-list">{faqs.map(([question, answer], index) => <article className="faq-item" key={question}><button type="button" aria-expanded={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? -1 : index)}><span>{question}</span><CaretDown /></button>{openFaq === index && <p>{answer}</p>}</article>)}</div></section>
      <section className="security-band"><Clock /><div><h2>Ready to inspect your first run?</h2><p>Get a useful trace in under ten minutes.</p></div><ButtonLink href="/product#demo" variant="light">Open the playbook</ButtonLink></section>
    </main><Footer /></>
  );
}

export function App() {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  if (path === "/product") return <ProductPage />;
  if (path === "/pricing") return <PricingPage />;
  return <HomePage />;
}
