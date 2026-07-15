import { useEffect, useRef, useState } from 'react'
import QQLoginModal, { type QQLoginModalType } from './QQLoginModal'

export default () => {
  const modalRef = useRef<QQLoginModalType>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const handleShow = () => {
      if (mounted) modalRef.current?.show()
      else {
        setMounted(true)
        requestAnimationFrame(() => modalRef.current?.show())
      }
    }
    global.app_event.on('showQQLogin', handleShow)
    return () => global.app_event.off('showQQLogin', handleShow)
  }, [mounted])

  return mounted ? <QQLoginModal ref={modalRef} /> : null
}
