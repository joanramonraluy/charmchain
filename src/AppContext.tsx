import { Block, MDS, MinimaEvents } from "@minima-global/mds"
import { createContext, useEffect, useRef, useState } from "react"
import { minimaService } from "./services/minima.service"

export const appContext = createContext<{
  loaded: boolean
  block: Block | null
}>({ loaded: false, block: null })

const AppProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const initialised = useRef(false)
  const [loaded, setLoaded] = useState(false)
  const [block, setBlock] = useState<Block | null>(null)

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

          // Initialize database after MDS is ready
          minimaService.initDB()

          // Initialize profile (publish address for token receiving)
          minimaService.initProfile()

          const command = await MDS.cmd.block()
          setBlock(command.response)
        }
      })
    }
  }, [])

  const context = {
    loaded,
    block,
  }

  return <appContext.Provider value={context}>{children}</appContext.Provider>
}

export default AppProvider
