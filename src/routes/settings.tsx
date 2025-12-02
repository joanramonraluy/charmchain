import { createFileRoute } from "@tanstack/react-router";
import { useContext, useEffect, useState } from "react";
import { MDS } from "@minima-global/mds";
import { appContext } from "../AppContext";
import { User, ChevronDown, ChevronUp, Copy, Check, Edit2, Globe, Palette, Shield, AlertTriangle, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: Settings,
});

const defaultAvatar =
  "data:image/svg+xml;base64," +
  btoa(
    `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'>
      <circle cx='24' cy='24' r='24' fill='#ccc'/>
      <text x='50%' y='55%' text-anchor='middle' font-size='20' fill='white' dy='.3em'>?</text>
     </svg>`
  );

function Settings() {
  const { loaded, updateUserProfile, writeMode } = useContext(appContext);


  // Profile State
  const [userName, setUserName] = useState("User");
  const [userAvatar, setUserAvatar] = useState(defaultAvatar);
  const [maximaAddress, setMaximaAddress] = useState("");
  const [minimaAddress, setMinimaAddress] = useState("");
  const [expandedAddress, setExpandedAddress] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [showAvatarDialog, setShowAvatarDialog] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFileSize, setAvatarFileSize] = useState(0);
  const [userDescription, setUserDescription] = useState("");
  const [editDescriptionValue, setEditDescriptionValue] = useState("");
  const [showDescriptionDialog, setShowDescriptionDialog] = useState(false);

  useEffect(() => {
    if (!loaded) return;

    const fetchProfile = async () => {
      try {
        // Fetch Maxima Info (Name, Icon, Maxima Address)
        const infoRes = await MDS.cmd.maxima({ params: { action: "info" } });
        const info = (infoRes.response as any) || {};

        if (info) {
          setUserName(info.name || "User");
          if (info.icon) {
            const decodedIcon = decodeURIComponent(info.icon);
            // Check if it's a valid data URL, and not a URL ending in /0x00 (no photo)
            if (decodedIcon.startsWith("data:image") && !decodedIcon.includes("/0x00")) {
              setUserAvatar(decodedIcon);
            } else {
              setUserAvatar(defaultAvatar);
            }
          }
          setMaximaAddress(info.contact || "");
        }

        // Fetch Minima Address (for receiving tokens)
        const newAddr = await MDS.cmd.getaddress();
        if ((newAddr.response as any)?.miniaddress) {
          setMinimaAddress((newAddr.response as any).miniaddress);
        }

      } catch (err) {
        console.error("Error fetching profile:", err);
      }
    };

    fetchProfile();
    fetchProfile();

    // Load description from local storage
    const savedDescription = localStorage.getItem("userDescription");
    if (savedDescription) {
      setUserDescription(savedDescription);
    }
  }, [loaded]);



  const handleEditName = async () => {
    console.log("[Settings] Opening edit dialog");
    setEditNameValue(userName);
    setShowEditDialog(true);
  };

  const handleSaveName = async () => {
    console.log("[Settings] Saving name:", editNameValue);
    if (editNameValue && editNameValue.trim() !== "") {
      try {
        console.log("[Settings] Attempting to set name to:", editNameValue.trim());

        // Use modern MDS API
        const response = await MDS.cmd.maxima({
          params: {
            action: "setname",
            name: editNameValue.trim()
          } as any
        });

        console.log("[Settings] MDS response:", response);

        if (response && (response as any).status === false) {
          throw new Error((response as any).error || "Failed to set name");
        }

        console.log("[Settings] Name set successfully, updating state");
        setUserName(editNameValue.trim());
        // Update global context to sync with Header and SideMenu
        updateUserProfile(editNameValue.trim(), userAvatar);
        setShowEditDialog(false);
      } catch (err) {
        console.error("[Settings] Error setting name:", err);
        alert("Failed to update name: " + (err as Error).message);
      }
    }
  };

  const handleEditAvatar = () => {
    setAvatarUrl(userAvatar);
    setAvatarFileSize(0);
    setShowAvatarDialog(true);
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Resize if too large (max 800x800)
          const maxSize = 800;
          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = (height / width) * maxSize;
              width = maxSize;
            } else {
              width = (width / height) * maxSize;
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          // Compress to JPEG with quality 0.8
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve(compressedDataUrl);
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSaveAvatar = async () => {
    console.log("[Settings] Saving avatar, file size:", avatarFileSize);

    if (avatarUrl && avatarUrl.trim() !== "") {
      try {
        const encodedIcon = encodeURIComponent(avatarUrl.trim());
        console.log("[Settings] Encoded icon length:", encodedIcon.length);
        console.log("[Settings] Attempting to set avatar...");

        // Use modern MDS API
        const response = await MDS.cmd.maxima({
          params: {
            action: "seticon",
            icon: encodedIcon
          } as any
        });

        console.log("[Settings] MDS full response:", JSON.stringify(response, null, 2));
        console.log("[Settings] Response status:", (response as any)?.status);
        console.log("[Settings] Response error:", (response as any)?.error);

        if (!response || (response as any).status === false) {
          const errorMsg = (response as any)?.error || "Failed to set avatar - no response";
          console.error("[Settings] Error:", errorMsg);
          throw new Error(errorMsg);
        }

        console.log("[Settings] Avatar set successfully, updating state");
        setUserAvatar(avatarUrl.trim());
        // Update global context to sync with Header and SideMenu
        updateUserProfile(userName, avatarUrl.trim());
        setShowAvatarDialog(false);
      } catch (err) {
        console.error("[Settings] Error setting avatar:", err);
        alert("Failed to update avatar: " + (err as Error).message);
      }
    }
  };

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const toggleAddress = (id: string) => {
    setExpandedAddress(expandedAddress === id ? null : id);
  };

  return (
    <>
      {/* Edit Name Dialog */}
      {showEditDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-96 max-w-full mx-4">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Edit Display Name</h3>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Display Name</label>
              <input
                type="text"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Enter your name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') setShowEditDialog(false);
                }}
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowEditDialog(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveName}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors font-medium"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Avatar Dialog */}
      {showAvatarDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-96 max-w-full mx-4">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Edit Avatar</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Image</label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Choose an image from your device (will be compressed to 800x800)</p>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setAvatarFileSize(file.size);
                    try {
                      const compressedUrl = await compressImage(file);
                      setAvatarUrl(compressedUrl);
                    } catch (err) {
                      console.error("Error compressing image:", err);
                    }
                  }
                }}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-300"
              />
            </div>

            {avatarUrl && (
              <div className="mb-4 flex justify-center">
                <img src={avatarUrl} alt="Preview" className="w-24 h-24 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowAvatarDialog(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAvatar}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors font-medium"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}



      <div className="max-w-4xl mx-auto p-4 md:p-8 bg-gray-50 min-h-screen">

        <div className="grid gap-6">

          {/* PROFILE SECTION */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center gap-3">
              <User className="text-blue-500" />
              <h2 className="text-xl font-semibold text-gray-800">Profile</h2>
            </div>

            {/* User Info - Full Width */}
            <div className="p-6 border-b border-gray-100 flex items-center gap-4">
              <div className="relative">
                <img
                  src={userAvatar}
                  alt="Avatar"
                  className="w-16 h-16 rounded-full object-cover border-4 border-gray-100"
                  onError={(e) => (e.target as HTMLImageElement).src = defaultAvatar}
                />
                <button
                  onClick={handleEditAvatar}
                  className="absolute -bottom-1 -right-1 p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-lg"
                  title="Change Avatar"
                >
                  <Edit2 size={12} />
                </button>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-gray-900">{userName}</h3>
                  <button
                    onClick={() => {
                      console.log("[Settings] Edit button clicked");
                      handleEditName();
                    }}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                    title="Edit Name"
                  >
                    <Edit2 size={16} />
                  </button>
                </div>
                <p className="text-sm text-gray-500">Visible to your contacts</p>
              </div>
            </div>

            {/* Description Section - Full Width */}
            <div className="border-b border-gray-100">
              <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">About</h3>
              </div>

              <div className="relative group">
                {showDescriptionDialog ? (
                  <textarea
                    value={editDescriptionValue}
                    onChange={(e) => setEditDescriptionValue(e.target.value)}
                    onBlur={() => {
                      // Auto-save on blur
                      const newDescription = editDescriptionValue.trim();
                      setUserDescription(newDescription);
                      localStorage.setItem("userDescription", newDescription);
                      setShowDescriptionDialog(false);
                    }}
                    className="w-full p-6 border-none focus:ring-0 resize-none min-h-[100px] text-gray-700 bg-white"
                    placeholder="Tell us about yourself..."
                    autoFocus
                  />
                ) : (
                  <div
                    onClick={() => {
                      setEditDescriptionValue(userDescription);
                      setShowDescriptionDialog(true);
                    }}
                    className="p-6 cursor-pointer hover:bg-gray-50 transition-colors min-h-[100px]"
                  >
                    {userDescription ? (
                      <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">{userDescription}</p>
                    ) : (
                      <p className="text-gray-400 text-sm italic">Add a description about yourself...</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Maxima Address - Full Width */}
            <div className="border-b border-gray-100">
              <button
                onClick={() => toggleAddress('maxima')}
                className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors text-left"
              >
                <span className="font-medium text-gray-700">My Maxima Address</span>
                {expandedAddress === 'maxima' ? <ChevronUp size={20} className="text-gray-500" /> : <ChevronDown size={20} className="text-gray-500" />}
              </button>

              {expandedAddress === 'maxima' && (
                <div className="px-6 pb-6 pt-0">
                  <p className="text-xs font-mono text-gray-600 break-all mb-3 bg-gray-50 p-3 rounded border border-gray-100">
                    {maximaAddress || "Loading..."}
                  </p>
                  <button
                    onClick={() => copyToClipboard(maximaAddress, 'maxima')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${copiedField === 'maxima' ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                  >
                    {copiedField === 'maxima' ? <Check size={16} /> : <Copy size={16} />}
                    {copiedField === 'maxima' ? 'Copied!' : 'Copy Address'}
                  </button>
                </div>
              )}
            </div>

            {/* Minima Address - Full Width */}
            <div>
              <button
                onClick={() => toggleAddress('minima')}
                className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors text-left"
              >
                <span className="font-medium text-gray-700">My Minima Address</span>
                {expandedAddress === 'minima' ? <ChevronUp size={20} className="text-gray-500" /> : <ChevronDown size={20} className="text-gray-500" />}
              </button>

              {expandedAddress === 'minima' && (
                <div className="px-6 pb-6 pt-0">
                  <p className="text-xs font-mono text-gray-600 break-all mb-3 bg-gray-50 p-3 rounded border border-gray-100">
                    {minimaAddress || "Loading..."}
                  </p>
                  <button
                    onClick={() => copyToClipboard(minimaAddress, 'minima')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${copiedField === 'minima' ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                  >
                    {copiedField === 'minima' ? <Check size={16} /> : <Copy size={16} />}
                    {copiedField === 'minima' ? 'Copied!' : 'Copy Address'}
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* APPLICATION MODE SECTION */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center gap-3">
              <Shield className={writeMode ? "text-green-500" : "text-yellow-500"} />
              <h2 className="text-xl font-semibold text-gray-800">Application Mode</h2>
            </div>
            <div className="p-6">
              <div className={`flex items-center gap-3 p-4 rounded-xl mb-4 ${writeMode ? 'bg-green-50 border border-green-100' : 'bg-yellow-50 border border-yellow-100'}`}>
                {writeMode ? (
                  <div className="p-2 bg-green-100 rounded-full text-green-600">
                    <Check size={20} />
                  </div>
                ) : (
                  <div className="p-2 bg-yellow-100 rounded-full text-yellow-600">
                    <AlertTriangle size={20} />
                  </div>
                )}
                <div>
                  <h3 className={`font-semibold ${writeMode ? 'text-green-800' : 'text-yellow-800'}`}>
                    {writeMode ? 'Write Mode Active' : 'Read Mode Active'}
                  </h3>
                  <p className={`text-sm ${writeMode ? 'text-green-600' : 'text-yellow-600'}`}>
                    {writeMode
                      ? 'CharmChain has full permission to send messages and tokens.'
                      : 'CharmChain needs your approval for every transaction.'}
                  </p>
                </div>
              </div>

              {!writeMode && (
                <div className="space-y-4">
                  <p className="text-gray-600 text-sm leading-relaxed">
                    To enable <strong>Write Mode</strong> and avoid repeated approval requests:
                  </p>
                  <ol className="list-decimal list-inside text-sm text-gray-600 space-y-2 pl-2">
                    <li>Go to <strong>Minima</strong> main screen</li>
                    <li>Open <strong>MiniDapps</strong></li>
                    <li>Find <strong>CharmChain</strong></li>
                    <li>Click the <strong>lock icon</strong> / permissions</li>
                    <li>Select <strong>Write Mode</strong></li>
                  </ol>

                  <button
                    onClick={() => {
                      // Save current path so we can restore it after reload
                      localStorage.setItem("lastRoute", "/settings");
                      window.location.reload();
                    }}
                    className="w-full mt-2 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={18} />
                    Check Permissions Again
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* APPEARANCE SECTION (Placeholder) */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden opacity-60">
            <div className="p-6 border-b border-gray-100 flex items-center gap-3">
              <Palette className="text-purple-500" />
              <h2 className="text-xl font-semibold text-gray-800">Appearance</h2>
            </div>
            <div className="p-6">
              <p className="text-gray-500">Theme customization coming soon.</p>
            </div>
          </section>

          {/* NETWORK SECTION (Placeholder) */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden opacity-60">
            <div className="p-6 border-b border-gray-100 flex items-center gap-3">
              <Globe className="text-green-500" />
              <h2 className="text-xl font-semibold text-gray-800">Network</h2>
            </div>
            <div className="p-6">
              <p className="text-gray-500">Network settings are managed by Minima.</p>
            </div>
          </section>

        </div >
      </div >
    </>
  );
}
