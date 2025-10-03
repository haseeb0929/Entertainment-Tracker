import React, { useState, useEffect } from "react";
import HomePage from "./components/HomePage";
import ProfilePage from "./components/ProfilePage";
import AuthPage from "./components/AuthPage";
import { useAuth } from "./utils/AuthContext";

function App() {
  const [currentPage, setCurrentPage] = useState("home");
  const { setAuth } = useAuth();

  const navigateToPage = (page) => {
    setCurrentPage(page);
  };

  // refresh access token when app starts
  useEffect(() => {
    const refresh = async () => {
      try {
        const res = await fetch("http://localhost:5000/auth/logout", {
          method: "POST",
          credentials: "include", // sends cookie
        });
        setAuth(null);
      } catch (err) {
        console.error("Refresh failed", err);
        setAuth(null);
      }
    };

    refresh();
  }, [setAuth]);

  const renderPage = () => {
    switch (currentPage) {
      case "home":
        return <HomePage navigateToPage={navigateToPage} />;
      case "profile":
        return <ProfilePage navigateToPage={navigateToPage} />;
      case "auth":
        return <AuthPage navigateToPage={navigateToPage} />;
      default:
        return <HomePage navigateToPage={navigateToPage} />;
    }
  };

  return <div className="App">{renderPage()}</div>;
}

export default App;
