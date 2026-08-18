import React, { useContext, useEffect, useState } from "react"
import { SceneContext } from "../context/SceneContext"
import CustomButton from "./custom-button"

import { getAtlasSize } from "../library/utils"

import styles from "./ExportMenu.module.css"
import { local } from "../library/store"
import { LanguageContext } from "../context/LanguageContext"

const defaultName = "Anon"

export const ExportMenu = ({currentPrice, onPurchaseClick}) => {

  // Translate hook
  const { t } = useContext(LanguageContext);
  const [name] = React.useState(localStorage.getItem("name") || defaultName)
  const [glbStatus, setGlbStatus] = useState("")
  const [glbBusy, setGlbBusy] = useState(false)
  const { model, characterManager } = useContext(SceneContext)

  useEffect(() => {
    const onStatus = (event) => {
      const detail = event.detail || {}
      if (detail.status === "working") {
        setGlbBusy(true)
        setGlbStatus(detail.message || `Exporting GLB… ${detail.strategy || ""}`)
      }
      if (detail.status === "success") {
        setGlbBusy(false)
        setGlbStatus(`GLB ready: ${detail.fileName} · ${detail.sizeMB} MB`)
      }
      if (detail.status === "blocked") {
        setGlbBusy(false)
        setGlbStatus(`GLB blocked: ${detail.message}`)
      }
      if (detail.status === "error") {
        setGlbBusy(false)
        setGlbStatus(`GLB failed: ${detail.message}`)
      }
    }
    window.addEventListener("character2027:glb-export", onStatus)
    return () => window.removeEventListener("character2027:glb-export", onStatus)
  }, [])

  const getOptions = () =>{
    const currentOption = local["mergeOptions_sel_option"] || 0;
    const createTextureAtlas = local["mergeOptions_create_atlas"] == null ? true:local["mergeOptions_create_atlas"] 
    return {
      createTextureAtlas : createTextureAtlas,
      mToonAtlasSize:getAtlasSize(local["mergeOptions_atlas_mtoon_size"] || 6),
      mToonAtlasSizeTransp:getAtlasSize(local["mergeOptions_atlas_mtoon_transp_size"] || 6),
      stdAtlasSize:getAtlasSize(local["mergeOptions_atlas_std_size"] || 6),
      stdAtlasSizeTransp:getAtlasSize(local["mergeOptions_atlas_std_transp_size"] || 6),
      ktxCompression:local["merge_options_ktx_compression"],
      exportStdAtlas:(currentOption === 0 || currentOption == 2),
      exportMtoonAtlas:(currentOption === 1 || currentOption == 2),
      twoSidedMaterial: (local["mergeOptions_two_sided_mat"] || false)
    }
  }

  const downloadVRM = (version) =>{
    const options = getOptions();
    /**
     * Blindly assume the whole avatar is VRM0 if the first vrm is VRM0
     */
    options.isVrm0 = Object.values(characterManager.avatar)[0].vrm.meta.metaVersion=='0'
    options.outputVRM0 = !(version === 1)
    characterManager.downloadVRM(name, options);
  }
  
  const downloadGLB = async () =>{
    if (glbBusy) return
    const options = getOptions();
    setGlbBusy(true)
    setGlbStatus("Preparing GLB…")
    try {
      await characterManager.downloadGLB(name, options);
    } catch (error) {
      setGlbBusy(false)
      setGlbStatus(`GLB failed: ${error?.message || error}`)
    }
  }

  const purchaseAssets = () =>{
    onPurchaseClick();
  }

  return (
    <React.Fragment>
      {currentPrice === 0 ? (
        <>
          <CustomButton
            theme="light"
            text={glbBusy ? "EXPORTING…" : "GLB"}
            icon="download"
            size={14}
            className={styles.button}
            onClick={downloadGLB}
          />
          {glbStatus && (
            <div style={{
              marginTop: 6,
              maxWidth: 280,
              fontSize: 11,
              lineHeight: 1.35,
              color: glbStatus.startsWith("GLB ready") ? "#7ee787" : glbStatus.startsWith("GLB failed") || glbStatus.startsWith("GLB blocked") ? "#ff9b9b" : "#d0d0d0",
            }}>
              {glbStatus}
            </div>
          )}
          <CustomButton
            theme="light"
            text="VRM 0"
            icon="download"
            size={14}
            className={styles.button}
            onClick={() => downloadVRM(0)}
          />
        </>
      ) : (
        <CustomButton
          theme="light"
          text="Purchase Assets"
          icon="purchase"
          size={14}
          className={styles.button}
          onClick={() => purchaseAssets()}
        />
      )}
    </React.Fragment>
  );
}
