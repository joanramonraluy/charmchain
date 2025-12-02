import { Block, MDS, MinimaEvents } from "@minima-global/mds"
import { createContext, useEffect, useRef, useState } from "react"
import { minimaService } from "./services/minima.service"


const defaultAvatar =
  "data:image/svg+xml;base64," +
  btoa(
    `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'>
      <circle cx='24' cy='24' r='24' fill='#ccc'/>
      <text x='50%' y='55%' text-anchor='middle' font-size='20' fill='white' dy='.3em'>?</text>
     </svg>`
  );

export const appContext = createContext<{
  loaded: boolean
  synced: boolean
  block: Block | null
  userName: string
  userAvatar: string
  writeMode: boolean
  updateUserProfile: (name: string, avatar: string) => void
}>({
  loaded: false,
  synced: false,
  block: null,
  userName: "User",
  userAvatar: defaultAvatar,
  writeMode: false,
  updateUserProfile: () => { }
})

const AppProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const initialised = useRef(false)
  const [loaded, setLoaded] = useState(false)
  const [synced, setSynced] = useState(false)
  const [block, setBlock] = useState<Block | null>(null)
  const [userName, setUserName] = useState("User")
  const [userAvatar, setUserAvatar] = useState(defaultAvatar)
  const [writeMode, setWriteMode] = useState(false)

  // Fetch user profile from Maxima
  const fetchUserProfile = async () => {
    try {
      const res = await MDS.cmd.maxima({ params: { action: "info" } })
      const info = (res.response as any) || {}

      if (info) {
        const name = info.name || "User"
        const icon = info.icon ? decodeURIComponent(info.icon) : defaultAvatar

        setUserName(name)
        // Check if it's a valid data URL, and not a URL ending in /0x00 (no photo)
        if (icon.startsWith("data:image") && !icon.includes("/0x00")) {
          setUserAvatar(icon)
        } else {
          setUserAvatar(defaultAvatar)
        }
      }
    } catch (err) {
      console.error("[AppContext] Error fetching user profile:", err)
    }
  }

  // Function to update user profile (called from Settings)
  const updateUserProfile = (name: string, avatar: string) => {
    setUserName(name)
    setUserAvatar(avatar)
  }

  useEffect(() => {
    if (!initialised.current) {
      initialised.current = true

      minimaService.init()

      MDS.init(async (msg) => {
        // RAW DEBUG LOG: See everything coming from Minima
        if (msg.event === "MAXIMA") {
          console.log("🔥 [AppContext] RAW MAXIMA EVENT:", msg);
        }

        // Pass event to service for processing (e.g. Maxima messages)
        minimaService.processEvent(msg)

        if (msg.event === MinimaEvents.INITED) {
          setLoaded(true)
          console.log("MDS initialised and ready! 🚀")
          console.log("MDS Init Message:", msg)

          // Check for Write Mode permission
          // Usually found in msg.data.conf.write or similar. 
          // We'll check a few common locations just in case.
          const isWriteMode = msg.data?.conf?.write === true || msg.data?.write === true;
          setWriteMode(isWriteMode);
          console.log("📝 [AppContext] Write Mode:", isWriteMode);

          // Initialize database after MDS is ready
          // We await this to ensure tables exist before running cleanup
          minimaService.initDB().then(() => {
            // Initialize profile (publish address for token receiving)
            minimaService.initProfile()

            // Cleanup orphaned pending transactions on app start
            // This syncs the DB with the actual node state (handling offline approvals/denials)
            console.log("🧹 [AppContext] Running initial transaction cleanup...");
            minimaService.cleanupOrphanedPendingTransactions();
          });

          // Start transaction polling service - DISABLED (replaced by MDS_PENDING event)
          // console.log("🔄 [AppContext] Starting transaction polling service");
          // transactionPollingService.start();

          // Fetch user profile
          fetchUserProfile()

          const command = await MDS.cmd.block()
          setBlock(command.response)
        }

        // Listen for NEWBLOCK events to detect synchronization
        if (msg.event === MinimaEvents.NEWBLOCK) {
          // When we receive a new block, the node is synced
          setSynced(true)
          const command = await MDS.cmd.block()
          setBlock(command.response)
        }
      })
    }
  }, [])

  const context = {
    loaded,
    synced,
    block,
    userName,
    userAvatar,
    writeMode,
    updateUserProfile,
  }

  return <appContext.Provider value={context}>{children}</appContext.Provider>
}

export default AppProvider
