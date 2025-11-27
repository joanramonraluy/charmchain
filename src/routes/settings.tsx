import { createFileRoute } from "@tanstack/react-router";
import { useContext, useEffect, useState } from "react";
import { MDS } from "@minima-global/mds";
import { appContext } from "../AppContext";
import { User, ChevronDown, ChevronUp, Copy, Check, Edit2, Globe, Palette } from "lucide-react";

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
  const { loaded } = useContext(appContext);


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

  useEffect(() => {
    if (!loaded) return;

    const fetchProfile = async () => {
      try {
        // Fetch Maxima Info (Name, Icon, Maxima Address)
        const infoRes = await MDS.cmd.maxima({ params: { action: "info" } });
        const info = (infoRes.response as any) || {};

        if (info) {
          setUserName(info.name || "User");
          if (info.icon) setUserAvatar(decodeURIComponent(info.icon));
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

            <div className="p-6 space-y-6">
              {/* User Info */}
              <div className="flex items-center gap-4">
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

              <div className="space-y-3">
                {/* Maxima Address */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleAddress('maxima')}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    <span className="font-medium text-gray-700">My Maxima Address</span>
                    {expandedAddress === 'maxima' ? <ChevronUp size={20} className="text-gray-500" /> : <ChevronDown size={20} className="text-gray-500" />}
                  </button>

                  {expandedAddress === 'maxima' && (
                    <div className="p-4 bg-white border-t border-gray-200">
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

                {/* Minima Address */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleAddress('minima')}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    <span className="font-medium text-gray-700">My Minima Address</span>
                    {expandedAddress === 'minima' ? <ChevronUp size={20} className="text-gray-500" /> : <ChevronDown size={20} className="text-gray-500" />}
                  </button>

                  {expandedAddress === 'minima' && (
                    <div className="p-4 bg-white border-t border-gray-200">
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
              </div>
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

        </div>
      </div>
    </>
  );
}
