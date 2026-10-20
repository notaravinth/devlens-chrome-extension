import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bug,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Code2,
  ExternalLink,
  Filter,
  Globe,
  LoaderCircle,
  Pause,
  Play,
  Search,
  ShieldCheck,
  Trash2,
  X,
  Zap,
} from "lucide-react";

const SITE_PERMISSIONS = {
  origins: ["http://*/*", "https://*/*"],
};

const FILTERS = [
  { label: "All errors", value: "all" },
  { label: "Runtime", value: "runtime" },
  { label: "Promises", value: "promise" },
  { label: "Console", value: "console" },
];

function explainError(error) {
  const rawMessage = String(error?.message || "");
  const message = rawMessage.toLowerCase();
  const type = String(error?.type || "").toLowerCase();
  const stack = String(error?.stack || "").toLowerCase();

  const result = (title, description, causes, fix, steps = []) => ({
    title,
    description,
    causes,
    fix,
    steps,
  });

  // 1. Accessing a property on null or undefined
  if (
    /cannot read propert(y|ies) of (undefined|null)/i.test(rawMessage) ||
    /cannot read properties of (undefined|null)/i.test(rawMessage)
  ) {
    const property = rawMessage.match(/reading ['"]([^'"]+)['"]/i)?.[1];

    const isMap = property === "map";

    return result(
      "Accessing a missing value",
      `Your code tried to read ${property ? `the "${property}" property` : "a property"} from a value that is undefined or null.`,
      [
        "Data may not have loaded before the code ran.",
        "An API response may be missing a field your code expects.",
        "A variable or object property may not have been initialised.",
      ],
      isMap
        ? "If this value should be an array, verify that it exists and is an array before calling .map(). Initialise it to [] only if an empty array is a valid default."
        : "Check the value immediately before the failing property access. Determine why it is missing before adding a fallback.",
      [
        "Inspect the variable immediately before the failing line.",
        "Check the API response or function arguments that supply the value.",
        "Use a breakpoint to determine when the value becomes undefined.",
      ],
    );
  }

  // 2. Calling a non-function
  if (/is not a function/i.test(message)) {
    return result(
      "Calling a value that is not a function",
      "JavaScript tried to call a value as a function, but the value was not callable.",
      [
        "The variable contains a different type than expected.",
        "The method name may be incorrect.",
        "An import or object property may refer to the wrong value.",
      ],
      "Inspect the value and its type before calling it. Verify the method name, object shape, and import.",
      [
        "Log typeof theValue before the call.",
        "Inspect the object in DevTools.",
        "Check recent changes to the function arguments or imports.",
      ],
    );
  }

  // 3. Reading a property of a value that has the wrong type
  if (/cannot read propert(y|ies) of/i.test(message)) {
    return result(
      "Property access failed",
      "The code attempted to access a property on a value that JavaScript could not use as expected.",
      [
        "The value may be null or undefined.",
        "The object may have a different shape than expected.",
        "A previous operation may have returned an unexpected result.",
      ],
      "Inspect the value and confirm its structure before accessing the property.",
      [
        "Check the complete error message for the property name.",
        "Inspect the value at the source line.",
        "Trace where the value was created or returned.",
      ],
    );
  }

  // 4. Undefined identifier
  if (/\bis not defined\b/i.test(message)) {
    const identifier = rawMessage.match(/^(.+?) is not defined/i)?.[1];

    return result(
      "Undefined variable or identifier",
      `${identifier ? `"${identifier}"` : "An identifier"} was referenced, but JavaScript could not find a declaration for it in the current scope.`,
      [
        "The variable or function may never have been declared.",
        "Its name may be misspelled or capitalised differently.",
        "The code may run before a required script or module is available.",
      ],
      "Check the identifier's spelling, declaration, import, and scope.",
      [
        "Search the project for the identifier.",
        "Verify that the required module is imported.",
        "Check whether the identifier is available in this execution context.",
      ],
    );
  }

  // 5. Null is not an object
  if (/cannot convert undefined or null to object/i.test(message)) {
    return result(
      "Expected an object but received null or undefined",
      "A JavaScript operation expected an object but received a missing value.",
      [
        "Object.keys(), Object.values(), or Object.entries() received null or undefined.",
        "A function returned no object.",
        "An API response was incomplete.",
      ],
      "Validate the input before passing it to the object operation. Choose an appropriate fallback only if it matches the intended behaviour.",
      [
        "Inspect the argument passed to Object.keys(), Object.values(), or Object.entries().",
        "Trace where that argument originates.",
      ],
    );
  }

  // 6. Invalid array operation
  if (
    /\.map is not a function|\.filter is not a function|\.reduce is not a function|\.forEach is not a function/i.test(
      message,
    )
  ) {
    return result(
      "Expected an array-like value",
      "The code attempted to use an array method on a value that does not provide that method.",
      [
        "The value may be an object or string instead of an array.",
        "An API may return an object containing the array in a nested property.",
        "The value may have been overwritten with a different type.",
      ],
      "Inspect the value with Array.isArray(value) and verify the API response shape before using the array method.",
      [
        "Inspect the value in DevTools.",
        "Check the API response and locate the actual array.",
        "Avoid silently replacing unexpected data with an empty array unless that is correct for the application.",
      ],
    );
  }

  // 7. Failed fetch request
  if (
    /failed to fetch|networkerror when attempting to fetch|load failed/i.test(
      message,
    )
  ) {
    return result(
      "Network request failed",
      "The fetch operation could not provide a usable response to the code.",
      [
        "The server may be unavailable or the URL may be incorrect.",
        "The browser may block the request because of CORS or another security restriction.",
        "A network connection, DNS lookup, or TLS connection may have failed.",
      ],
      "Inspect the request in the Network tab. Check the URL, server availability, browser network errors, and CORS configuration.",
      [
        "Open DevTools → Network and reproduce the request.",
        "Inspect the request URL and browser error details.",
        "Check the server logs if you control the server.",
      ],
    );
  }

  // 8. HTTP error responses
  if (
    /http error|request failed with status code|status code 4\d\d|status code 5\d\d/i.test(
      message,
    )
  ) {
    return result(
      "HTTP request returned an error",
      "A request appears to have received an unsuccessful HTTP status response.",
      [
        "A 4xx status often indicates a request, authentication, or permission issue.",
        "A 5xx status often indicates a server-side failure.",
        "The endpoint may require different parameters or credentials.",
      ],
      "Inspect the actual HTTP status and response body in the Network tab. A fetch call does not reject automatically just because the server returns a 4xx or 5xx status.",
      [
        "Inspect the response status and body.",
        "Verify the request method, URL, and parameters.",
        "Check authentication and server logs where available.",
      ],
    );
  }

  // 9. Syntax errors
  if (type === "runtime" && /syntaxerror/i.test(message)) {
    return result(
      "JavaScript syntax error",
      "The JavaScript engine could not parse a piece of code or data.",
      [
        "A bracket, quote, comma, or operator may be missing.",
        "The code may contain syntax unsupported by the target environment.",
        "A JSON string may be malformed.",
      ],
      "Inspect the reported source location and nearby code. If JSON parsing failed, inspect the input string before parsing it.",
      [
        "Open the source file and navigate to the reported line.",
        "Check the surrounding brackets, quotes, and punctuation.",
        "For JSON errors, validate the exact input.",
      ],
    );
  }

  // 10. Assignment to a constant
  if (/assignment to constant variable|assignment to const/i.test(message)) {
    return result(
      "Attempted to reassign a constant",
      "The code attempted to assign a new value to a variable declared with const.",
      [
        "The variable is being reassigned rather than updated through its contents.",
        "A variable may have been declared const when reassignment was intended.",
      ],
      "Use let if reassignment is required, or restructure the code to avoid reassignment. Remember that const prevents rebinding, not mutation of an object's contents.",
      [
        "Find the const declaration.",
        "Locate the assignment that triggers the error.",
        "Choose the correct variable declaration or update pattern.",
      ],
    );
  }

  // 11. Invalid JSON
  if (
    /unexpected token.*json|is not valid json|unexpected end of json input/i.test(
      message,
    )
  ) {
    return result(
      "JSON parsing failed",
      "The input could not be parsed as valid JSON.",
      [
        "The input may be empty or truncated.",
        "The response may contain HTML or plain text instead of JSON.",
        "The JSON may contain invalid quotes, commas, or syntax.",
      ],
      "Inspect the raw input before parsing it. If it came from a response, check the response status and content type as well.",
      [
        "Log or inspect the raw input safely.",
        "Check whether the response body is actually JSON.",
        "Validate the JSON syntax.",
      ],
    );
  }

  // 12. Promise rejection
  if (
    type === "promise" ||
    /unhandledrejection|unhandled promise rejection/i.test(message)
  ) {
    return result(
      "Unhandled promise rejection",
      "An asynchronous operation rejected, and no rejection handler handled it at the time of the event.",
      [
        "A network request or asynchronous operation failed.",
        "An async function threw an exception.",
        "A rejected promise was not awaited inside a try/catch or given a catch handler.",
      ],
      "Find the promise that rejected and handle the failure where recovery or reporting belongs. Do not suppress the error without addressing the cause.",
      [
        "Inspect the rejection reason and stack trace.",
        "Check the relevant await expression or promise chain.",
        "Add appropriate try/catch or .catch() handling.",
      ],
    );
  }

  // 13. React-related hints, based only on the available message
  if (/too many re-renders|maximum update depth exceeded/i.test(message)) {
    return result(
      "React update loop",
      "React appears to be repeatedly rendering or updating state without reaching a stable result.",
      [
        "State may be updated unconditionally during rendering.",
        "An effect may update state on every run.",
        "A callback may invoke a state update immediately instead of passing a function.",
      ],
      "Find the repeated state update and ensure effects have correct dependencies and state changes can settle.",
      [
        "Inspect the component named in the stack trace.",
        "Check state updates in the component body and effects.",
        "Verify event handlers pass callbacks rather than calling them during render.",
      ],
    );
  }

  if (/invalid hook call|hooks can only be called/i.test(message)) {
    return result(
      "React Hook usage error",
      "React reported a Hook call that does not follow its rules.",
      [
        "A Hook may be called outside a function component or custom Hook.",
        "A Hook may be called conditionally or inside a loop.",
        "Multiple incompatible React copies or mismatched React packages may be involved.",
      ],
      "Call Hooks at the top level of function components or custom Hooks. Also verify React package versions and dependency duplication.",
      [
        "Inspect the first application stack frame.",
        "Check whether the Hook is called conditionally.",
        "Check React and React DOM versions if the code follows the Rules of Hooks.",
      ],
    );
  }

  // 14. CORS hints
  if (
    /cors|cross-origin request blocked|access-control-allow-origin/i.test(
      message,
    )
  ) {
    return result(
      "Possible cross-origin request restriction",
      "The browser message suggests that a cross-origin request may have been blocked by browser security rules.",
      [
        "The server may not return the required CORS headers.",
        "The request may use credentials or headers that trigger a preflight.",
        "The server may reject the OPTIONS preflight request.",
      ],
      "Inspect the browser Console and Network tab. Configure CORS on the server that owns the endpoint; client-side code cannot bypass browser CORS enforcement.",
      [
        "Inspect the failed request and any OPTIONS preflight.",
        "Read the exact browser CORS message.",
        "Configure the server to allow the intended origin, method, and headers.",
      ],
    );
  }

  // Fallback
  return result(
    "JavaScript error",
    "DevLens captured this error but could not match it to a specific explanation rule.",
    [
      "The error may depend on application-specific logic.",
      "The message may not match any current rule.",
      "Additional source code or runtime context may be needed to determine the cause.",
    ],
    "Use the stack trace and source location to find the failing operation. Treat these suggestions as hypotheses, not a confirmed diagnosis.",
    [
      "Open the source location shown in the error.",
      "Inspect the values used at the failing line.",
      "Reproduce the issue and compare the expected and actual values.",
    ],
  );
}

function formatTime(timestamp) {
  if (!timestamp) return "Unknown time";

  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return "Unknown";

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;

  return `${Math.floor(seconds / 86400)}d ago`;
}

function ErrorTypeIcon({ type }) {
  if (type === "promise") return <Zap size={15} />;
  if (type === "console") return <Code2 size={15} />;

  return <AlertTriangle size={15} />;
}

function App() {
  const [errors, setErrors] = useState([]);
  const [monitoring, setMonitoring] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    if (!globalThis.chrome?.storage?.local) {
      setLoading(false);
      setNotice(
        "Open DevLens from chrome://extensions to use extension features.",
      );
      return;
    }

    chrome.storage.local
      .get(["errors", "monitoringEnabled"])
      .then((data) => {
        setErrors(Array.isArray(data.errors) ? data.errors : []);
        setMonitoring(data.monitoringEnabled === true);
      })
      .catch(() => setNotice("Could not load local error history."))
      .finally(() => setLoading(false));

    const handleStorageChange = (changes, areaName) => {
      if (areaName !== "local") return;

      if (changes.errors) {
        setErrors(
          Array.isArray(changes.errors.newValue) ? changes.errors.newValue : [],
        );
      }

      if (changes.monitoringEnabled) {
        setMonitoring(changes.monitoringEnabled.newValue === true);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const filteredErrors = useMemo(() => {
    const query = search.trim().toLowerCase();

    return errors.filter((error) => {
      const matchesType = filter === "all" || error.type === filter;

      const matchesSearch =
        !query ||
        error.message?.toLowerCase().includes(query) ||
        error.origin?.toLowerCase().includes(query) ||
        error.source?.toLowerCase().includes(query);

      return matchesType && matchesSearch;
    });
  }, [errors, filter, search]);

  const totalOccurrences = errors.reduce(
    (total, error) => total + (Number(error.count) || 1),
    0,
  );

  const runtimeCount = errors.filter(
    (error) => error.type === "runtime",
  ).length;
  const promiseCount = errors.filter(
    (error) => error.type === "promise",
  ).length;
  const consoleCount = errors.filter(
    (error) => error.type === "console",
  ).length;

  async function toggleMonitoring() {
    if (busy) return;

    setBusy(true);
    setNotice("");

    try {
      if (!monitoring) {
        const granted = await chrome.permissions.request(SITE_PERMISSIONS);

        if (!granted) {
          setNotice("Website access was not granted. Monitoring remains off.");
          return;
        }

        const result = await chrome.runtime.sendMessage({
          type: "DEVLENS_ENABLE",
        });

        if (!result?.ok) {
          throw new Error(result?.error || "Could not enable monitoring.");
        }

        setMonitoring(true);
        setNotice(
          "Monitoring enabled. Reload the website tabs you want to inspect.",
        );
      } else {
        const result = await chrome.runtime.sendMessage({
          type: "DEVLENS_DISABLE",
        });

        if (!result?.ok) {
          throw new Error(result?.error || "Could not disable monitoring.");
        }

        setMonitoring(false);
        setNotice(
          "Monitoring disabled. Reload existing tabs to remove their current capture scripts.",
        );
      }
    } catch (error) {
      setNotice(error.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function clearHistory() {
    setBusy(true);

    try {
      const result = await chrome.runtime.sendMessage({
        type: "DEVLENS_CLEAR",
      });

      if (!result?.ok) throw new Error("Could not clear error history.");

      setErrors([]);
      setExpandedId(null);
      setShowClearConfirm(false);
      setNotice("Local error history cleared.");
    } catch (error) {
      setNotice(error.message || "Could not clear history.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="w-[720px] max-w-full min-h-[560px] max-h-[600px] overflow-y-auto bg-[#090b10] text-slate-100">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.08] bg-[#0b0d12]/95 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-blue-400">
            <Bug size={22} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight">DevLens</h1>
              <span className="rounded-md border border-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                Beta
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              JavaScript error inspector
            </p>
          </div>
        </div>

        <div
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
            monitoring
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              : "border-white/10 bg-white/[0.03] text-slate-400"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              monitoring ? "animate-pulse bg-emerald-400" : "bg-slate-500"
            }`}
          />
          {monitoring ? "Monitoring active" : "Monitoring paused"}
        </div>
      </header>

      <section className="space-y-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.16em] text-blue-400">
              Overview
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">
              Your error dashboard
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Find issues. Understand them. Fix them.
            </p>
          </div>

          <button
            onClick={toggleMonitoring}
            disabled={busy || loading}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
              monitoring
                ? "border border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/10"
                : "bg-blue-600 text-white shadow-lg shadow-blue-950/30 hover:bg-blue-500"
            }`}
          >
            {busy ? (
              <LoaderCircle className="animate-spin" size={16} />
            ) : monitoring ? (
              <Pause size={16} />
            ) : (
              <Play size={16} />
            )}
            {monitoring ? "Pause capture" : "Enable capture"}
          </button>
        </div>

        {notice && (
          <div className="flex items-start gap-2 rounded-xl border border-blue-400/15 bg-blue-400/[0.06] p-3 text-xs leading-5 text-blue-200">
            <CircleHelp className="mt-0.5 shrink-0" size={15} />
            <span className="flex-1">{notice}</span>
            <button
              onClick={() => setNotice("")}
              aria-label="Dismiss notice"
              className="text-blue-300/70 hover:text-white"
            >
              <X size={15} />
            </button>
          </div>
        )}

        <div className="grid grid-cols-4 gap-3">
          <StatCard
            label="Unique errors"
            value={errors.length}
            icon={<Bug size={16} />}
            accent="blue"
          />
          <StatCard
            label="Occurrences"
            value={totalOccurrences}
            icon={<Activity size={16} />}
            accent="purple"
          />
          <StatCard
            label="Runtime"
            value={runtimeCount}
            icon={<AlertTriangle size={16} />}
            accent="orange"
          />
          <StatCard
            label="Promises"
            value={promiseCount}
            icon={<Zap size={16} />}
            accent="pink"
          />
        </div>

        <div className="grid grid-cols-[1fr_1fr] gap-3">
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
              <Code2 size={17} />
            </div>
            <div>
              <p className="text-xs text-slate-500">Console errors</p>
              <p className="mt-0.5 text-lg font-semibold">{consoleCount}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300">
              <ShieldCheck size={17} />
            </div>
            <div>
              <p className="text-xs text-slate-500">Storage</p>
              <p className="mt-0.5 text-sm font-semibold">Local only</p>
            </div>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d1017]">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-4">
            <div>
              <h3 className="font-semibold">Captured errors</h3>
              <p className="mt-1 text-xs text-slate-500">
                {filteredErrors.length} results · {errors.length} stored
              </p>
            </div>

            <button
              onClick={() => setShowClearConfirm(true)}
              disabled={errors.length === 0 || busy}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs text-slate-500 transition hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Trash2 size={14} />
              Clear history
            </button>
          </div>

          {showClearConfirm && (
            <div className="flex items-center justify-between gap-3 border-b border-red-500/20 bg-red-500/[0.06] px-4 py-3">
              <p className="text-xs text-red-200">
                Permanently clear locally stored errors?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="rounded-lg px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={clearHistory}
                  disabled={busy}
                  className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-400 disabled:opacity-50"
                >
                  Confirm
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3 p-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search messages or websites..."
                  className="w-full rounded-xl border border-white/[0.08] bg-[#090b10] py-2.5 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-600 focus:border-blue-500/50"
                />
              </div>

              <div className="relative">
                <Filter
                  size={14}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  className="h-full appearance-none rounded-xl border border-white/[0.08] bg-[#090b10] py-2.5 pl-8 pr-7 text-xs text-slate-300 outline-none focus:border-blue-500/50"
                >
                  {FILTERS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={13}
                  className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-500"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center py-12 text-slate-500">
                <LoaderCircle className="mb-3 animate-spin" size={25} />
                <p className="text-sm">Loading error history...</p>
              </div>
            ) : filteredErrors.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-slate-500">
                  {search ? <Search size={21} /> : <Check size={22} />}
                </div>

                <h4 className="text-sm font-semibold text-slate-200">
                  {search || filter !== "all"
                    ? "No matching errors"
                    : "Nothing captured yet"}
                </h4>

                <p className="mt-2 max-w-xs text-xs leading-5 text-slate-500">
                  {search || filter !== "all"
                    ? "Try a different search or filter."
                    : monitoring
                      ? "Reload a website and trigger a JavaScript error to test DevLens."
                      : "Enable capture, grant website access and reload a website to start collecting errors."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredErrors.map((error) => {
                  const expanded = expandedId === error.id;
                  const explanation = explainError(error);

                  return (
                    <article
                      key={error.id}
                      className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02] transition hover:border-white/[0.13]"
                    >
                      <button
                        onClick={() =>
                          setExpandedId(expanded ? null : error.id)
                        }
                        className="flex w-full items-start gap-3 p-3.5 text-left"
                      >
                        <div
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            error.type === "runtime"
                              ? "bg-orange-400/10 text-orange-300"
                              : error.type === "promise"
                                ? "bg-purple-400/10 text-purple-300"
                                : "bg-cyan-400/10 text-cyan-300"
                          }`}
                        >
                          <ErrorTypeIcon type={error.type} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="mb-1.5 flex flex-wrap items-center gap-2">
                            <span className="rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                              {error.type}
                            </span>

                            {(error.count || 1) > 1 && (
                              <span className="rounded border border-blue-400/15 bg-blue-400/[0.07] px-1.5 py-0.5 text-[9px] font-semibold text-blue-300">
                                ×{error.count}
                              </span>
                            )}
                          </div>

                          <p className="break-words font-mono text-xs leading-5 text-slate-200">
                            {error.message}
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                            <span className="flex min-w-0 items-center gap-1">
                              <Globe size={11} />
                              <span className="max-w-[250px] truncate">
                                {error.origin || "Unknown website"}
                              </span>
                            </span>

                            <span className="flex items-center gap-1">
                              <Clock3 size={11} />
                              {formatRelativeTime(error.lastSeen)}
                            </span>

                            {error.line > 0 && <span>Line {error.line}</span>}
                          </div>
                        </div>

                        <span className="mt-1 shrink-0 text-slate-500">
                          {expanded ? (
                            <ChevronDown size={16} />
                          ) : (
                            <ChevronRight size={16} />
                          )}
                        </span>
                      </button>

                      {expanded && (
                        <div className="space-y-4 border-t border-white/[0.07] bg-black/10 p-4">
                          <div>
                            <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-blue-300">
                              <CircleHelp size={14} />
                              {explanation.title}
                            </div>
                            <p className="text-xs leading-5 text-slate-400">
                              {explanation.description}
                            </p>
                          </div>

                          <div>
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Likely causes
                            </p>
                            <ul className="space-y-1.5">
                              {explanation.causes.map((cause) => (
                                <li
                                  key={cause}
                                  className="flex gap-2 text-xs leading-5 text-slate-400"
                                >
                                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-blue-400" />
                                  {cause}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="rounded-lg border border-emerald-400/10 bg-emerald-400/[0.04] p-3">
                            <p className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                              <Check size={13} />
                              Suggested next step
                            </p>
                            <p className="text-xs leading-5 text-slate-300">
                              {explanation.fix}
                            </p>
                          </div>

                          {explanation.steps?.length > 0 && (
                            <div>
                              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Debugging checklist
                              </p>

                              <ol className="list-decimal space-y-2 pl-5 text-xs leading-5 text-slate-400">
                                {explanation.steps.map((step, index) => (
                                  <li key={`${index}-${step}`}>{step}</li>
                                ))}
                              </ol>
                            </div>
                          )}

                          <div className="space-y-1 text-[10px] text-slate-500">
                            <p>First seen: {formatTime(error.firstSeen)}</p>
                            <p>Last seen: {formatTime(error.lastSeen)}</p>
                            {error.source && (
                              <p className="break-all">
                                Source: {error.source}
                                {error.line ? `:${error.line}` : ""}
                                {error.column ? `:${error.column}` : ""}
                              </p>
                            )}
                          </div>

                          {error.stack && (
                            <details className="group">
                              <summary className="cursor-pointer text-xs text-slate-400 hover:text-white">
                                View stack trace
                              </summary>
                              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3 font-mono text-[10px] leading-5 text-slate-400">
                                {error.stack}
                              </pre>
                            </details>
                          )}

                          <p className="text-[10px] leading-4 text-slate-600">
                            This is a rule-based explanation, not a confirmed
                            diagnosis of the underlying bug.
                          </p>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <footer className="flex items-center justify-between gap-3 px-1 pb-1 text-[10px] text-slate-600">
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={12} />
            Error history stays on this device
          </span>
          <span>DevLens v1.0.0</span>
        </footer>
      </section>
    </main>
  );
}

function StatCard({ label, value, icon, accent }) {
  const accents = {
    blue: "bg-blue-400/10 text-blue-300",
    purple: "bg-purple-400/10 text-purple-300",
    orange: "bg-orange-400/10 text-orange-300",
    pink: "bg-pink-400/10 text-pink-300",
  };

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
      <div className="mb-3 flex items-center justify-between gap-1">
        <span className="text-[10px] leading-4 text-slate-500">{label}</span>
        <span className={`rounded-lg p-1.5 ${accents[accent]}`}>{icon}</span>
      </div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

export default App;
