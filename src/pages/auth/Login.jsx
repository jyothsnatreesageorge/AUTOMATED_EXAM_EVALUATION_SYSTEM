import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

const ROLES = [
  { id: "admin", icon: "🛡️", label: "Admin" },
  { id: "teacher", icon: "🎓", label: "Teacher" },
  { id: "student", icon: "👤", label: "Student" },
];

const ROLE_ROUTES = {
  admin: "/admin",
  teacher: "/teacher",
  student: "/student",
};

const Login = () => {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute("data-theme") || "dark"
  );

  const isDark = theme === "dark";
  const API_BASE = import.meta.env.VITE_API_BASE_URL;

  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedRole = localStorage.getItem("role");

    if (token && savedRole && ROLE_ROUTES[savedRole]) {
      navigate(ROLE_ROUTES[savedRole]);
    }
  }, [navigate]);

  const toggleTheme = () => {
    const next = isDark ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("sage-theme", next);
  };

  const handleLogin = async () => {
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Please enter username and password.");
      return;
    }

    if (!API_BASE) {
      setError("Backend URL is not configured.");
      return;
    }

    let url = "";

    if (role === "student") {
      url = `${API_BASE}/api/students/login`;
    } else if (role === "teacher") {
      url = `${API_BASE}/api/teacherlogin/login`;
    } else if (role === "admin") {
      url = `${API_BASE}/api/admin/login`;
    }

    try {
      setLoading(true);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: username,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", role);

        let userData;

        if (role === "student") {
          userData = data.student;
        } else if (role === "teacher") {
          userData = data.teacher;
        } else if (role === "admin") {
          userData = data.admin;
        }

        localStorage.setItem(
          "user",
          JSON.stringify({
            ...userData,
            role,
          })
        );

        navigate(ROLE_ROUTES[role]);
      } else {
        setError(data.message || "Invalid credentials");
      }
    } catch (err) {
      setError("Cannot reach backend server.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-left-glow" />

        <div className="login-left-content">
          <h1 className="site-name">SAGE</h1>
          <p className="tagline">Empowering Education Digitally</p>

          <div className="login-divider" />

          <div className="login-features">
            <div className="feature-pill">📋 Automated Exam Evaluation</div>
            <div className="feature-pill">📊 Real-time Result Tracking</div>
            <div className="feature-pill">🔄 Seamless Revaluation Workflow</div>
            <div className="feature-pill">📖 Reference Answer Management</div>
          </div>
        </div>
      </div>

      <div className="login-right">
        <div className="login-card">
          <p className="login-card-logo">SAGE</p>

          <h2>Welcome Back</h2>
          <p className="subtitle">Sign in to continue</p>

          <div className="role-selector">
            {ROLES.map(({ id, icon, label }) => (
              <button
                key={id}
                className={`role-btn ${role === id ? "selected" : ""}`}
                onClick={() => setRole(id)}
                type="button"
              >
                <span className="role-btn-icon">{icon}</span>
                <span className="role-label">{label}</span>
              </button>
            ))}
          </div>

          <div className="form-row">
            <label>Email</label>
            <input
              type="text"
              placeholder="Enter your email"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError("");
              }}
              onKeyDown={handleKeyDown}
            />
          </div>

          <div className="form-row">
            <label>Password</label>
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              onKeyDown={handleKeyDown}
            />
          </div>

          <button
            className="login-btn"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In →"}
          </button>

          <div className="theme-switch-wrapper">
            <label className="theme-switch">
              <input
                type="checkbox"
                checked={isDark}
                onChange={toggleTheme}
              />
              <div className="slider"></div>
            </label>

            <span>{isDark ? "Dark Mode" : "Light Mode"}</span>
          </div>

          {error && <p className="login-error">{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default Login;
