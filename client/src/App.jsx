import React, { useState } from "react";
import HomePage from "./components/HomePage";
import ProfilePage from "./components/ProfilePage";
import AuthPage from "./components/AuthPage";
import ItemDetailsPage from "./components/ItemDetailsPage";
import { useAuth } from "./utils/AuthContext";

function App() {
  const [currentPage, setCurrentPage] = useState("home");
  const [pageProps, setPageProps] = useState({});
  const { setAuth } = useAuth();

  const navigateToPage = (page, props = {}) => {
    setCurrentPage(page);
    setPageProps(props);
  };

  const renderPage = () => {
    switch (currentPage) {
      case "home":
        return <HomePage navigateToPage={navigateToPage} />;
      case "profile":
        return <ProfilePage navigateToPage={navigateToPage} />;
      case "auth":
        return <AuthPage navigateToPage={navigateToPage} />;
      case "itemDetailsPage":
        return <ItemDetailsPage navigateToPage={navigateToPage} {...pageProps} />;
      default:
        return <HomePage navigateToPage={navigateToPage} />;
    }
  };

  return <div className="App">{renderPage()}</div>;
}

export default App;
