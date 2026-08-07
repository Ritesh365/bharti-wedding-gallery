import React, { useState, useEffect, useCallback } from "react";
import { RAW_HALDI_PHOTOS, RAW_WEDDING_PHOTOS } from "./constants";

// Web3Forms Public Access Key
const WEB3FORMS_ACCESS_KEY = "ab8e78ed-bda9-49bc-bc3c-f75baa4ecf72";
const VISITOR_EMAIL_KEY = "wedding_visitor_email";
const FAVORITES_STORAGE_KEY = "wedding_photo_favs";

const getDriveDirectUrl = (urlOrId, size) => {
  if (!urlOrId) return "";
  const idMatch = urlOrId.match(/[-\w]{25,}/);
  const fileId = idMatch ? idMatch[0] : urlOrId;
  if (size === 0) {
    return `https://lh3.googleusercontent.com/d/${fileId}=s0`;
  }
  return size
    ? `https://lh3.googleusercontent.com/d/${fileId}=s${size}`
    : `https://lh3.googleusercontent.com/d/${fileId}`;
};

const getDriveThumbnailUrl = (urlOrId) => getDriveDirectUrl(urlOrId, 420);

const getDrivePreviewUrl = (urlOrId) => {
  const width = typeof window !== "undefined" ? window.innerWidth : 1200;
  const ratio =
    typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const previewSize = Math.min(2048, Math.max(1200, Math.round(width * ratio)));
  return getDriveDirectUrl(urlOrId, previewSize);
};

// --- FULL HALDI, MEHNDI & TILAK PHOTO ARRAY ---

const HALDI_PHOTOS = RAW_HALDI_PHOTOS.map(getDriveDirectUrl);
const WEDDING_PHOTOS = RAW_WEDDING_PHOTOS.map(getDriveDirectUrl);

// Reusable Image Item Component with Loading Skeleton and Hover Effects
const GalleryItem = ({ url, index, isFav, toggleFavorite, openLightbox }) => {
  const [loaded, setLoaded] = useState(false);
  const thumbUrl = getDriveThumbnailUrl(url);

  return (
    <div className="masonry-item" onClick={() => openLightbox(index)}>
      {!loaded && <div className="skeleton-loader" />}
      <img
        src={thumbUrl}
        alt={`Gallery ${index}`}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        style={{ opacity: loaded ? 1 : 0 }}
      />
      {loaded && (
        <div className="item-overlay">
          <button
            className="action-btn"
            onClick={(e) => toggleFavorite(e, url)}
            style={{ color: isFav ? "#e74c3c" : "#FFFFFF" }}
          >
            {isFav ? "♥" : "♡"}
          </button>
        </div>
      )}
    </div>
  );
};

const loadFavoritesForEmail = (email) => {
  if (!email) return [];
  try {
    const stored = JSON.parse(
      localStorage.getItem(FAVORITES_STORAGE_KEY) || "{}",
    );
    return Array.isArray(stored[email]) ? stored[email] : [];
  } catch {
    return [];
  }
};

const saveFavoritesForEmail = (email, favs) => {
  if (!email) return;
  try {
    const stored = JSON.parse(
      localStorage.getItem(FAVORITES_STORAGE_KEY) || "{}",
    );
    stored[email] = favs;
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // ignore write failures
  }
};

export default function App() {
  const [visitorEmail, setVisitorEmail] = useState(
    () => localStorage.getItem(VISITOR_EMAIL_KEY) || "",
  );
  const [inputEmail, setInputEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem("activeTab") || "iframe-tab",
  );

  const [favorites, setFavorites] = useState(() =>
    loadFavoritesForEmail(localStorage.getItem(VISITOR_EMAIL_KEY)),
  );

  const [lightbox, setLightbox] = useState({
    isOpen: false,
    photos: [],
    currentIndex: 0,
  });
  const [toast, setToast] = useState("");
  const [showOnlyFavs, setShowOnlyFavs] = useState(false);

  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  useEffect(() => {
    if (visitorEmail) {
      saveFavoritesForEmail(visitorEmail, favorites);
    }
  }, [favorites, visitorEmail]);

  useEffect(() => {
    if (visitorEmail) {
      setFavorites(loadFavoritesForEmail(visitorEmail));
    } else {
      setFavorites([]);
    }
  }, [visitorEmail]);

  const exportFavoritesToTxt = () => {
    if (favorites.length === 0) {
      triggerToast("You don't have any favorites to export yet!");
      return;
    }

    // 1. Format the content for the text file
    let fileContent = `Wedding Gallery Favorites for: ${visitorEmail}\n`;
    fileContent += `Date: ${new Date().toLocaleString()}\n`;
    fileContent += `Total Favorites: ${favorites.length}\n`;
    fileContent += `--------------------------------------------------\n\n`;

    favorites.forEach((url, index) => {
      // Extract the Drive ID from your direct URL format to use as a "name"
      const idMatch = url.match(/d\/([-\w]{25,})/);
      const photoId = idMatch ? idMatch[1] : `Photo_${index + 1}`;

      fileContent += `${index + 1}. Photo ID: ${photoId}\n`;
      fileContent += `   Link: ${url}\n\n`;
    });

    // 2. Create a Blob (a file-like object of immutable, raw data)
    const blob = new Blob([fileContent], { type: "text/plain" });

    // 3. Create a temporary link element to trigger the download
    const downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(blob);

    // Set the file name (e.g., favorites_ritesh.kumar.txt)
    const safeEmail = visitorEmail ? visitorEmail.split("@")[0] : "visitor";
    downloadLink.download = `wedding_favorites_${safeEmail}.txt`;

    // 4. Programmatically click the link to download, then clean it up
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    triggerToast("Favorites exported successfully! 📝");
  };

  const toggleFavorite = (e, url) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const isRemoving = prev.includes(url);
      triggerToast(
        isRemoving ? "Removed from Favorites" : "Added to Favorites ♥",
      );
      return isRemoving ? prev.filter((item) => item !== url) : [...prev, url];
    });
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!inputEmail || !inputEmail.includes("@")) {
      triggerToast("Please enter a valid email.");
      return;
    }

    setIsSubmitting(true);
    try {
      await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_key: WEB3FORMS_ACCESS_KEY,
          subject: "✨ New Wedding Gallery Visitor Logged In",
          email: inputEmail,
          message: `Visitor Email ID: ${inputEmail}\nDate: ${new Date().toLocaleString()}`,
        }),
      });
    } catch (err) {
      console.log("Saved email locally.");
    }

    localStorage.setItem(VISITOR_EMAIL_KEY, inputEmail);
    setVisitorEmail(inputEmail);
    setInputEmail("");
    setIsSubmitting(false);
    triggerToast("Welcome to the gallery! ✨");
  };

  const handleLogout = () => {
    localStorage.removeItem(VISITOR_EMAIL_KEY);
    setVisitorEmail("");
    setInputEmail("");
    setFavorites([]);
    setShowOnlyFavs(false);
  };

  const handleTabSwitch = (tabId) => {
    setActiveTab(tabId);
    localStorage.setItem("activeTab", tabId);
  };

  const downloadPhoto = (e, photoUrl) => {
    if (e) e.stopPropagation();
    window.open(photoUrl, "_blank");
    triggerToast("Opening image...");
  };

  const openLightbox = (photos, index) =>
    setLightbox({ isOpen: true, photos, currentIndex: index });
  const closeLightbox = () =>
    setLightbox((prev) => ({ ...prev, isOpen: false }));

  const nextLightboxPhoto = useCallback((e) => {
    if (e) e.stopPropagation();
    setLightbox((prev) => ({
      ...prev,
      currentIndex: (prev.currentIndex + 1) % prev.photos.length,
    }));
  }, []);

  const prevLightboxPhoto = useCallback((e) => {
    if (e) e.stopPropagation();
    setLightbox((prev) => ({
      ...prev,
      currentIndex:
        (prev.currentIndex - 1 + prev.photos.length) % prev.photos.length,
    }));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!lightbox.isOpen) return;
      if (e.key === "ArrowRight") nextLightboxPhoto();
      if (e.key === "ArrowLeft") prevLightboxPhoto();
      if (e.key === "Escape") closeLightbox();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightbox.isOpen, nextLightboxPhoto, prevLightboxPhoto]);

  const displayHaldiPhotos = showOnlyFavs
    ? HALDI_PHOTOS.filter((url) => favorites.includes(url))
    : HALDI_PHOTOS;
  const displayWeddingPhotos = showOnlyFavs
    ? WEDDING_PHOTOS.filter((url) => favorites.includes(url))
    : WEDDING_PHOTOS;
  const currentPreviewPhoto = lightbox.isOpen
    ? lightbox.photos[lightbox.currentIndex]
    : null;
  const isCurrentPreviewFavorite = Boolean(
    currentPreviewPhoto && favorites.includes(currentPreviewPhoto),
  );

  return (
    <div className="body-wrapper">
      <style>{`
        /* Global & Animations */
        @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&family=Montserrat:wght@400;600;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');
        
        .body-wrapper {
          min-height: 100vh;
          width: 100%;
          font-family: 'Montserrat', sans-serif;
          background: linear-gradient(rgba(18, 12, 10, 0.65), rgba(18, 12, 10, 0.65)), url("https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=2000&q=80") center/cover no-repeat fixed;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 2rem 1rem;
          box-sizing: border-box;
          color: #2C221E;
        }

        @keyframes pulseGlow {
          0% { box-shadow: 0 0 20px rgba(212, 175, 55, 0.3); }
          50% { box-shadow: 0 0 40px rgba(212, 175, 55, 0.7); }
          100% { box-shadow: 0 0 20px rgba(212, 175, 55, 0.3); }
        }

        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Toast Notifications */
        .toast {
          position: fixed;
          bottom: 30px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(20, 15, 12, 0.9);
          color: #D4AF37;
          padding: 12px 24px;
          border-radius: 30px;
          border: 1px solid rgba(212, 175, 55, 0.4);
          z-index: 4000;
          font-weight: 600;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          animation: slideUpFade 0.3s ease-out;
        }

        /* Masonry Grid */
        .masonry-grid {
          column-count: 4;
          column-gap: 1.2rem;
          width: 100%;
        }
        @media (max-width: 1100px) {
          .masonry-grid {
            column-count: 3;
            column-gap: 1rem;
          }
        }
        @media (max-width: 768px) {
          .masonry-grid {
            column-count: 2;
            column-gap: 0.8rem;
          }
        }
        @media (max-width: 480px) {
          .masonry-grid {
            column-count: 2;
            column-gap: 0.75rem;
            width: 100%;
            padding: 0;
          }
        }

        .masonry-item {
          display: inline-block;
          width: 100%;
          break-inside: avoid-column;
          margin-bottom: 1.2rem;
          position: relative;
          border-radius: 18px;
          overflow: hidden;
          cursor: pointer;
          background: rgba(10, 6, 4, 0.15);
          box-shadow: 0 14px 40px rgba(0,0,0,0.14);
          transition: transform 0.35s ease, box-shadow 0.35s ease;
        }
        @media (max-width: 768px) {
          .masonry-item {
            margin-bottom: 1rem;
          }
        }
        @media (max-width: 480px) {
          .masonry-item {
            margin-bottom: 0.9rem;
            transition: transform 0.25s ease, box-shadow 0.25s ease, filter 0.25s ease;
          }
          .masonry-item:active {
            transform: translateY(-2px) scale(1.01);
            box-shadow: 0 18px 32px rgba(0,0,0,0.18);
            filter: saturate(1.04);
          }
        }

        .masonry-item:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 48px rgba(0,0,0,0.2);
          z-index: 10;
        }

        .masonry-item img {
          width: 100%;
          height: auto;
          object-fit: cover;
          display: block;
          transition: transform 0.35s ease, opacity 0.35s ease;
          border-radius: 18px;
          aspect-ratio: 4 / 5;
        }
        @media (max-width: 1100px) {
          .masonry-item img {
            aspect-ratio: 4 / 5;
          }
        }
        @media (max-width: 768px) {
          .masonry-item img {
            aspect-ratio: 3 / 4;
          }
        }
        @media (max-width: 480px) {
          .masonry-item img {
            aspect-ratio: 3 / 4;
          }
        }

        .masonry-item:hover img {
          transform: scale(1.03);
        }

        .skeleton-loader {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(90deg, #EAE2D6 25%, #F5F0E6 50%, #EAE2D6 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite linear;
        }
        @keyframes shimmer { to { background-position: -200% 0; } }

        .item-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 40%);
          opacity: 0;
          transition: opacity 0.3s ease;
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;
          padding: 12px;
        }
        .masonry-item:hover .item-overlay { opacity: 1; }

        .action-btn {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(4px);
          border: 1px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 1.2rem;
          transition: all 0.2s ease;
        }
        .action-btn:hover { background: rgba(255, 255, 255, 0.25); transform: scale(1.1); }

        /* UI Components */
        .glass-panel {
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(10px);
          border-radius: 24px;
          border: 1px solid rgba(212, 175, 55, 0.6);
          box-shadow: 0 15px 40px rgba(0, 0, 0, 0.25);
        }

        .tab-content { animation: slideUpFade 0.5s ease; }
        
        @media (max-width: 480px) {
          .tab-content {
            padding: 0.75rem !important;
          }
        }
        
        /* Switch Toggle */
        .toggle-container {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.85rem;
          font-weight: 600;
          color: #AA820A;
        }
        .toggle-switch {
          position: relative;
          width: 44px;
          height: 24px;
          background-color: #EAE2D6;
          border-radius: 24px;
          cursor: pointer;
          transition: 0.3s;
          border: 1px solid #D4AF37;
        }
        .toggle-switch.active { background-color: #D4AF37; }
        .toggle-switch::after {
          content: '';
          position: absolute;
          top: 2px;
          left: 2px;
          width: 18px;
          height: 18px;
          background-color: white;
          border-radius: 50%;
          transition: 0.3s;
        }
        .toggle-switch.active::after { transform: translateX(20px); }

        /* Mobile Responsive Header */
        @media (max-width: 768px) {
          .body-wrapper {
            padding: 1.5rem 1rem;
          }
        }
        @media (max-width: 480px) {
          .body-wrapper {
            padding: 1rem 0.75rem;
          }
        }
      `}</style>

      {/* TOAST NOTIFICATION */}
      {toast && <div className="toast">{toast}</div>}

      {/* LOGIN OVERLAY */}
      {!visitorEmail && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10, 6, 4, 0.92)",
            backdropFilter: "blur(15px)",
            zIndex: 3000,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "1rem",
          }}
        >
          <div
            className="glass-panel"
            style={{
              padding: "3rem 2.5rem",
              maxWidth: "460px",
              width: "100%",
              textAlign: "center",
              animation: "pulseGlow 4s infinite",
            }}
          >
            <p
              style={{
                fontSize: "0.8rem",
                textTransform: "uppercase",
                letterSpacing: "4px",
                color: "#B38B27",
                fontWeight: 700,
                margin: 0,
              }}
            >
              The Wedding Celebration Of
            </p>
            <h2
              style={{
                fontFamily: "'Great Vibes', cursive",
                fontSize: "3.8rem",
                color: "#2C221E",
                margin: "0.5rem 0 1rem 0",
                textShadow: "1px 1px 2px rgba(0,0,0,0.1)",
              }}
            >
              Nisha{" "}
              <span
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontStyle: "italic",
                  fontSize: "1.8rem",
                  color: "#AA820A",
                }}
              >
                weds
              </span>{" "}
              Sumit
            </h2>
            <p
              style={{
                fontSize: "0.9rem",
                color: "#555",
                marginBottom: "2rem",
                lineHeight: "1.5",
              }}
            >
              We are delighted to share these moments with you. Please sign in
              to view the gallery.
            </p>

            <form
              onSubmit={handleLoginSubmit}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1.2rem",
              }}
            >
              <input
                type="email"
                placeholder="Enter your email address"
                value={inputEmail}
                onChange={(e) => setInputEmail(e.target.value)}
                required
                style={{
                  padding: "1rem 1.5rem",
                  borderRadius: "30px",
                  border: "1.5px solid #D4AF37",
                  fontSize: "1rem",
                  outline: "none",
                  textAlign: "center",
                  background: "#FAFAFA",
                  color: "#2C221E",
                }}
              />
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: "1rem",
                  borderRadius: "30px",
                  border: "none",
                  background: "linear-gradient(135deg, #D4AF37, #B38B27)",
                  color: "#FFF",
                  fontWeight: 700,
                  fontSize: "1rem",
                  cursor: "pointer",
                  transition: "transform 0.2s",
                  boxShadow: "0 4px 15px rgba(212, 175, 55, 0.4)",
                }}
              >
                {isSubmitting
                  ? "Unlocking Gallery..."
                  : "Enter Wedding Gallery 🥂"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header
        className="glass-panel"
        style={{
          textAlign: "center",
          marginBottom: "2rem",
          padding: "1.5rem 2rem",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          boxSizing: "border-box",
          maxWidth: "100%",
        }}
      >
        <h1
          style={{
            fontFamily: "'Great Vibes', cursive",
            fontSize: "clamp(2.5rem, 6vw, 4rem)",
            color: "#2C221E",
            margin: "0",
            lineHeight: "1.2",
          }}
        >
          Nisha{" "}
          <span
            style={{
              fontFamily: "'Playfair Display', serif",
              fontStyle: "italic",
              fontSize: "clamp(1.2rem, 3vw, 2rem)",
              color: "#AA820A",
              margin: "0 0.25rem",
            }}
          >
            weds
          </span>{" "}
          Sumit
        </h1>

        {visitorEmail && (
          <div
            style={{
              display: "flex",
              gap: "1rem",
              alignItems: "center",
              margin: "1rem 0",
              fontSize: "0.85rem",
              color: "#555",
              background: "rgba(212, 175, 55, 0.1)",
              padding: "6px 16px",
              borderRadius: "20px",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <span>
              Welcome,{" "}
              <strong style={{ color: "#AA820A" }}>{visitorEmail}</strong>
            </span>
            <span style={{ color: "#D4AF37" }}>|</span>
            <span>
              Favorites selected:{" "}
              <strong style={{ color: "#AA820A" }}>{favorites.length}</strong>
            </span>
            <span style={{ color: "#D4AF37" }}>|</span>
            <button
              onClick={handleLogout}
              style={{
                background: "none",
                border: "none",
                color: "#888",
                textDecoration: "underline",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Logout
            </button>
          </div>
        )}

        <nav
          style={{
            display: "flex",
            gap: "0.8rem",
            width: "100%",
            justifyContent: "center",
            flexWrap: "wrap",
            marginTop: "0.5rem",
          }}
        >
          {[
            { id: "iframe-tab", icon: "📸", label: "Interactive Album" },
            {
              id: "photos-tab",
              icon: "🌼",
              label: `Haldi & Tilak (${HALDI_PHOTOS.length})`,
            },
            {
              id: "photos-tab1",
              icon: "👑",
              label: `Wedding Day (${WEDDING_PHOTOS.length})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabSwitch(tab.id)}
              style={{
                background:
                  activeTab === tab.id
                    ? "linear-gradient(135deg, #D4AF37, #AA820A)"
                    : "#FFF",
                color: activeTab === tab.id ? "#FFF" : "#2C221E",
                border: "1.5px solid #D4AF37",
                padding: "0.7rem 1.4rem",
                borderRadius: "30px",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.85rem",
                transition: "all 0.3s ease",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "1.1rem" }}>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* MAIN CONTENT */}
      <main style={{ width: "100%", flex: 1 }}>
        {/* Tab 1: iFrame */}
        {activeTab === "iframe-tab" && (
          <div className="tab-content" style={{ width: "100%" }}>
            <div
              className="glass-panel"
              style={{
                height: "78vh",
                minHeight: "600px",
                overflow: "hidden",
                padding: "8px",
              }}
            >
              <iframe
                allowFullScreen
                src="https://site.fotoowl.ai/rkstudi64/gallery/333143?embed=true&cover=true&pass_key=326641"
                loading="lazy"
                title="Wedding Gallery"
                style={{
                  width: "100%",
                  height: "100%",
                  border: 0,
                  borderRadius: "16px",
                }}
              />
            </div>
          </div>
        )}

        {/* Tab 2: Haldi Photos */}
        {activeTab === "photos-tab" && (
          <div
            className="tab-content glass-panel"
            style={{ padding: "2rem", width: "100%", boxSizing: "border-box" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.5rem",
                borderBottom: "1.5px solid rgba(212, 175, 55, 0.3)",
                paddingBottom: "1rem",
                flexWrap: "wrap",
                gap: "1rem",
              }}
            >
              <h2
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "2rem",
                  margin: 0,
                  color: "#2C221E",
                }}
              >
                Haldi, Mehndi & Tilak
              </h2>
              <div
                style={{ display: "flex", alignItems: "center", gap: "20px" }}
              >
                <button
                  onClick={exportFavoritesToTxt}
                  style={{
                    background: "rgba(212, 175, 55, 0.1)",
                    border: "1px solid #D4AF37",
                    color: "#AA820A",
                    padding: "6px 16px",
                    borderRadius: "20px",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    transition: "all 0.2s",
                  }}
                  onMouseOver={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(212, 175, 55, 0.2)")
                  }
                  onMouseOut={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(212, 175, 55, 0.1)")
                  }
                >
                  📥 Download Favorites List
                </button>

                <div
                  className="toggle-container"
                  onClick={() => setShowOnlyFavs(!showOnlyFavs)}
                  style={{ cursor: "pointer" }}
                >
                  <span>Show My Favorites</span>
                  <div
                    className={`toggle-switch ${showOnlyFavs ? "active" : ""}`}
                  />
                </div>
              </div>
            </div>

            {displayHaldiPhotos.length === 0 ? (
              <div
                style={{ textAlign: "center", padding: "3rem", color: "#888" }}
              >
                No favorite photos yet. Click the heart on a photo to save it!
              </div>
            ) : (
              <div className="masonry-grid">
                {displayHaldiPhotos.map((url, i) => (
                  <GalleryItem
                    key={url}
                    url={url}
                    index={i}
                    isFav={favorites.includes(url)}
                    toggleFavorite={toggleFavorite}
                    openLightbox={() => openLightbox(displayHaldiPhotos, i)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Wedding Photos */}
        {activeTab === "photos-tab1" && (
          <div
            className="tab-content glass-panel"
            style={{ padding: "2rem", width: "100%", boxSizing: "border-box" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.5rem",
                borderBottom: "1.5px solid rgba(212, 175, 55, 0.3)",
                paddingBottom: "1rem",
                flexWrap: "wrap",
                gap: "1rem",
              }}
            >
              <h2
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "2rem",
                  margin: 0,
                  color: "#2C221E",
                }}
              >
                Wedding Day
              </h2>
              <div
                style={{ display: "flex", alignItems: "center", gap: "20px" }}
              >
                <button
                  onClick={exportFavoritesToTxt}
                  style={{
                    background: "rgba(212, 175, 55, 0.1)",
                    border: "1px solid #D4AF37",
                    color: "#AA820A",
                    padding: "6px 16px",
                    borderRadius: "20px",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    transition: "all 0.2s",
                  }}
                  onMouseOver={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(212, 175, 55, 0.2)")
                  }
                  onMouseOut={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(212, 175, 55, 0.1)")
                  }
                >
                  📥 Download Favorites List
                </button>

                <div
                  className="toggle-container"
                  onClick={() => setShowOnlyFavs(!showOnlyFavs)}
                  style={{ cursor: "pointer" }}
                >
                  <span>Show My Favorites Only</span>
                  <div
                    className={`toggle-switch ${showOnlyFavs ? "active" : ""}`}
                  />
                </div>
              </div>
            </div>

            {displayWeddingPhotos.length === 0 ? (
              <div
                style={{ textAlign: "center", padding: "3rem", color: "#888" }}
              >
                No favorite photos yet. Click the heart on a photo to save it!
              </div>
            ) : (
              <div className="masonry-grid">
                {displayWeddingPhotos.map((url, i) => (
                  <GalleryItem
                    key={url}
                    url={url}
                    index={i}
                    isFav={favorites.includes(url)}
                    toggleFavorite={toggleFavorite}
                    openLightbox={() => openLightbox(displayWeddingPhotos, i)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* LIGHTBOX MODAL */}
      {lightbox.isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10, 6, 4, 0.95)",
            backdropFilter: "blur(8px)",
            zIndex: 4000,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            animation: "slideUpFade 0.3s ease",
          }}
        >
          <span
            onClick={closeLightbox}
            style={{
              position: "absolute",
              top: "20px",
              right: "30px",
              color: "#FFF",
              fontSize: "3rem",
              cursor: "pointer",
              zIndex: 4020,
              textShadow: "0 2px 10px rgba(0,0,0,0.5)",
            }}
          >
            &times;
          </span>

          <button
            onClick={prevLightboxPhoto}
            style={{
              position: "absolute",
              left: "20px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(255,255,255,0.1)",
              backdropFilter: "blur(4px)",
              color: "#FFF",
              border: "1px solid rgba(212, 175, 55, 0.5)",
              width: "50px",
              height: "50px",
              borderRadius: "50%",
              cursor: "pointer",
              zIndex: 4010,
              fontSize: "1.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "0.2s",
            }}
            onMouseOver={(e) =>
              (e.currentTarget.style.background = "rgba(212, 175, 55, 0.3)")
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
            }
          >
            &#10094;
          </button>

          <div
            style={{
              position: "relative",
              width: "min(100vw - 2rem, 1200px)",
              maxHeight: "calc(100vh - 3rem)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <img
              src={getDrivePreviewUrl(lightbox.photos[lightbox.currentIndex])}
              alt="Preview"
              loading="eager"
              style={{
                width: "100%",
                maxHeight: "calc(100vh - 220px)",
                objectFit: "contain",
                borderRadius: "8px",
                boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
              }}
              referrerPolicy="no-referrer"
            />
            <div
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "1rem",
                marginTop: "1rem",
                background: "rgba(20, 15, 12, 0.8)",
                borderRadius: "12px",
                color: "#EAE2D6",
              }}
            >
              <span>
                {lightbox.currentIndex + 1} / {lightbox.photos.length}
              </span>
              <div
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  alignItems: "center",
                }}
              >
                <button
                  onClick={(e) => {
                    if (currentPreviewPhoto)
                      toggleFavorite(e, currentPreviewPhoto);
                  }}
                  style={{
                    background: isCurrentPreviewFavorite
                      ? "#e74c3c"
                      : "rgba(255,255,255,0.12)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    color: isCurrentPreviewFavorite ? "#FFF" : "#111",
                    padding: "8px 16px",
                    borderRadius: "20px",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                  }}
                >
                  {isCurrentPreviewFavorite ? "♥ Favorited" : "♡ Favorite"}
                </button>
                <button
                  onClick={() =>
                    downloadPhoto(null, lightbox.photos[lightbox.currentIndex])
                  }
                  style={{
                    background: "#D4AF37",
                    border: "none",
                    color: "#111",
                    padding: "8px 20px",
                    borderRadius: "20px",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                  }}
                >
                  Download HQ
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={nextLightboxPhoto}
            style={{
              position: "absolute",
              right: "20px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(255,255,255,0.1)",
              backdropFilter: "blur(4px)",
              color: "#FFF",
              border: "1px solid rgba(212, 175, 55, 0.5)",
              width: "50px",
              height: "50px",
              borderRadius: "50%",
              cursor: "pointer",
              zIndex: 4010,
              fontSize: "1.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "0.2s",
            }}
            onMouseOver={(e) =>
              (e.currentTarget.style.background = "rgba(212, 175, 55, 0.3)")
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
            }
          >
            &#10095;
          </button>
        </div>
      )}
    </div>
  );
}
