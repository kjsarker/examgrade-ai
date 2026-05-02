import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center">
            <span className="text-white font-bold text-sm">E</span>
          </div>
          <span className="font-semibold text-gray-900">ExamGrade AI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2">
            Log in
          </Link>
          <Link href="/signup" className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-24 pb-20">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
          Powered by Claude AI
        </div>
        <h1 className="text-5xl font-semibold text-gray-900 max-w-2xl leading-tight tracking-tight mb-6">
          Grade exam papers in minutes, not days
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mb-10">
          Upload student scripts, your rubric, and let AI grade consistently and fairly.
          Get structured results, question-by-question feedback, and exportable reports.
        </p>
        <div className="flex items-center gap-3">
          <Link href="/signup" className="bg-gray-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors text-sm">
            Start grading free
          </Link>
          <Link href="/login" className="border border-gray-200 text-gray-700 px-6 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm">
            Sign in
          </Link>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="max-w-5xl mx-auto px-6 pb-24 grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: "⚡", title: "Batch Grading", desc: "Upload 500 papers at once. AI grades each one consistently against your rubric." },
          { icon: "🎚️", title: "3 Difficulty Modes", desc: "Easy, Medium, or Hard grading. Customize strictness to match your academic standards." },
          { icon: "📊", title: "Structured Results", desc: "Question-by-question breakdown with scores, feedback, CSV & PDF reports." },
          { icon: "✉️", title: "Email Delivery", desc: "Grading results sent directly to your inbox with attached reports." },
          { icon: "🧠", title: "Custom Prompts", desc: "Edit the AI grading instructions to match your exact evaluation style." },
          { icon: "🔒", title: "Secure & Private", desc: "All files encrypted and stored securely. Only you can access your data." },
        ].map((f) => (
          <div key={f.title} className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
            <div className="text-2xl mb-3">{f.icon}</div>
            <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Pricing */}
      <section className="bg-gray-50 border-t border-gray-100 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center mb-14">
          <h2 className="text-3xl font-semibold text-gray-900 mb-3">Simple pricing</h2>
          <p className="text-gray-500">Start free, upgrade when you need more.</p>
        </div>
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { name: "Trial", price: "Free", papers: "50 papers lifetime", cta: "Get started", href: "/signup", highlight: false },
            { name: "Pro", price: "$49.99/mo", papers: "200 papers/month", cta: "Start Pro", href: "/signup", highlight: true },
            { name: "Premium", price: "$99.99/mo", papers: "500 papers/month", cta: "Start Premium", href: "/signup", highlight: false },
          ].map((p) => (
            <div key={p.name} className={`rounded-2xl p-8 border ${p.highlight ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200"}`}>
              <div className={`text-sm font-medium mb-1 ${p.highlight ? "text-gray-400" : "text-gray-500"}`}>{p.name}</div>
              <div className={`text-3xl font-semibold mb-1 ${p.highlight ? "text-white" : "text-gray-900"}`}>{p.price}</div>
              <div className={`text-sm mb-6 ${p.highlight ? "text-gray-400" : "text-gray-500"}`}>{p.papers}</div>
              <Link href={p.href} className={`block text-center py-2.5 rounded-xl text-sm font-medium transition-colors ${p.highlight ? "bg-white text-gray-900 hover:bg-gray-100" : "bg-gray-900 text-white hover:bg-gray-800"}`}>
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <footer className="text-center py-8 text-sm text-gray-400 border-t border-gray-100">
        © {new Date().getFullYear()} ExamGrade AI. Built for professors.
      </footer>
    </div>
  );
}
