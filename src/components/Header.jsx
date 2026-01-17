import React, { useState, useEffect, useRef } from "react";

const Header = ({ onSettingsClick, onLogout, onWishlistClick, onPreferencesClick }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef(null);

    // Toggle dropdown
    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <header className="dashboard-header-fancy">
            <div className="header-left">
                <img src="/images/image.png" alt="BrandLint Logo" className="brand-logo" />
                <h2 className="t">BrandLint</h2>
            </div>
            
            <div className="header-right">
                <button 
                    className="icon-btn-fancy wishlist-trigger" 
                    title="Wishlist" 
                    onClick={onWishlistClick}
                >
                    <span className="heart-icon">❤️</span>
                </button>

                <div className="settings-container" ref={menuRef}>
                    <button 
                        className={`icon-btn-fancy settings-trigger ${isMenuOpen ? 'active' : ''}`} 
                        onClick={toggleMenu}
                    >
                        ⚙️
                    </button>

                    {isMenuOpen && (
                        <div className="settings-dropdown slide-up">
                            {/* Profile Summary Section */}
                            <div className="dropdown-profile-info">
                                <p className="profile-label">Personal Account</p>
                                <p className="profile-email">user@brandlint.io</p>
                            </div>

                            <div className="dropdown-divider"></div>

                            <ul className="dropdown-list">
                                <li className="dropdown-item" onClick={() => {
                                    onPreferencesClick?.();
                                    setIsMenuOpen(false);
                                }}>
                                    <span className="item-icon">👤</span> 
                                    <div className="item-text">
                                        <p className="item-title">Preferences</p>
                                        <p className="item-subtitle">Account settings & theme</p>
                                    </div>
                                </li>
                                
                                <li className="dropdown-item" onClick={() => console.log("Help Clicked")}>
                                    <span className="item-icon">❓</span> 
                                    <div className="item-text">
                                        <p className="item-title">Help Center</p>
                                        <p className="item-subtitle">Tutorials & Support</p>
                                    </div>
                                </li>

                                <div className="dropdown-divider"></div>

                                <li className="dropdown-item logout-item" onClick={() => {
                                    onLogout?.();
                                    setIsMenuOpen(false);
                                }}>
                                    <span className="item-icon">🚪</span> 
                                    <div className="item-text">
                                        <p className="item-title">Sign Out</p>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;