
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff, Aperture } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

const Index = () => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevImageDataRef = useRef<ImageData | null>(null);
  const captureIntervalRef = useRef<number | null>(null);
  const isNative = Capacitor.isNativePlatform();

  // Request camera permission and initialize
  useEffect(() => {
    const initCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Media Devices API not supported in your browser");
        }

        // Reset error state
        setCameraError(null);
        
        // iOS Safari works better with these constraints
        const constraints = {
          audio: false,
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        };
        
        console.log("Requesting media with constraints:", constraints);
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log("Stream obtained:", stream.getVideoTracks()[0].label);
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          
          // Important: Add both event handlers for better iOS compatibility
          videoRef.current.onloadedmetadata = () => {
            console.log("Video metadata loaded");
            if (videoRef.current) {
              console.log("Attempting to play video");
              const playPromise = videoRef.current.play();
              
              if (playPromise !== undefined) {
                playPromise
                  .then(() => {
                    console.log("Video playing successfully");
                    setHasCameraPermission(true);
                  })
                  .catch(err => {
                    console.error("Error playing video:", err);
                    setCameraError("Video konnte nicht abgespielt werden. Bitte erlaube autoplay im Browser.");
                    
                    // On iOS, autoplay might be blocked, so we need user interaction
                    toast({
                      title: "Tippe auf den Bildschirm",
                      description: "Um die Kamera zu starten, tippe bitte auf den Bildschirm.",
                      variant: "default"
                    });
                  });
              }
            }
          };
          
          // Additional event for iOS
          videoRef.current.onplaying = () => {
            console.log("Video is now playing");
            setHasCameraPermission(true);
          };
        }
      } catch (error) {
        console.error("Error accessing camera:", error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        setCameraError(`Zugriff auf die Kamera nicht möglich: ${errorMsg}`);
        
        toast({
          title: "Kamera-Fehler",
          description: "Zugriff auf die Kamera nicht möglich. Bitte erlaube den Kamerazugriff.",
          variant: "destructive"
        });
      }
    };

    initCamera();

    // Create a click event handler for the entire page
    // This helps iOS Safari which might need user interaction to start video
    const handleBodyClick = () => {
      if (videoRef.current && videoRef.current.paused) {
        console.log("Body clicked, attempting to play video");
        videoRef.current.play()
          .then(() => console.log("Video started after user interaction"))
          .catch(err => console.error("Still couldn't play video:", err));
      }
    };

    document.body.addEventListener('click', handleBodyClick);

    return () => {
      // Clean up video stream when component unmounts
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      document.body.removeEventListener('click', handleBodyClick);
    };
  }, []);

  // Calculate difference between two images
  const calculateImageDifference = (current: ImageData, previous: ImageData): number => {
    const data1 = current.data;
    const data2 = previous.data;
    let diffCount = 0;
    const totalPixels = data1.length / 4;

    // Compare pixels (RGB values, ignore alpha)
    for (let i = 0; i < data1.length; i += 4) {
      const r1 = data1[i];
      const g1 = data1[i + 1];
      const b1 = data1[i + 2];
      
      const r2 = data2[i];
      const g2 = data2[i + 1];
      const b2 = data2[i + 2];
      
      // Simple threshold for pixel difference
      if (
        Math.abs(r1 - r2) > 30 ||
        Math.abs(g1 - g2) > 30 ||
        Math.abs(b1 - b2) > 30
      ) {
        diffCount++;
      }
    }

    // Return percentage of different pixels
    return (diffCount / totalPixels) * 100;
  };

  // Capture a photo and save it
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) return;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Get current image data
    const currentImageData = context.getImageData(0, 0, canvas.width, canvas.height);
    
    // If we have a previous image, compare them
    if (prevImageDataRef.current) {
      const difference = calculateImageDifference(currentImageData, prevImageDataRef.current);
      
      // If difference is over 50%, save the photo
      if (difference >= 50) {
        // Save photo
        savePhoto(canvas);
        setPhotoCount(prev => prev + 1);
        prevImageDataRef.current = currentImageData;
      }
    } else {
      // First capture - save it and set as previous
      savePhoto(canvas);
      setPhotoCount(prev => prev + 1);
      prevImageDataRef.current = currentImageData;
    }
  };

  // Save photo to user's device
  const savePhoto = async (canvas: HTMLCanvasElement) => {
    try {
      // Convert canvas to blob or base64
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      
      if (isNative) {
        // On native platforms (iOS/Android), save to filesystem
        try {
          const fileName = `photo-sequence-${Date.now()}.jpg`;
          const base64Data = dataUrl.split(',')[1];
          
          // Write the file to the filesystem first
          await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Cache
          });
          
          // Now move it to the gallery
          const fileUri = await Filesystem.getUri({
            directory: Directory.Cache,
            path: fileName
          });
          
          // Save to photo gallery would happen here
          // This would require Capacitor's Photos plugin
          // For now we'll just save it to the filesystem
          
          toast({
            title: "Foto gespeichert",
            description: `Foto ${photoCount + 1} wurde auf dem Gerät gespeichert.`,
          });
        } catch (err) {
          console.error("Error saving to filesystem:", err);
          throw err;
        }
      } else {
        // For web browser, use the download approach
        const blob = await (await fetch(dataUrl)).blob();
        const url = URL.createObjectURL(blob);
        
        // Create and trigger download
        const link = document.createElement('a');
        link.href = url;
        link.download = `photo-sequence-${Date.now()}.jpg`;
        link.click();
        
        // Clean up
        URL.revokeObjectURL(url);
        
        toast({
          title: "Foto gespeichert",
          description: `Foto ${photoCount + 1} wurde gespeichert.`,
        });
      }
    } catch (error) {
      console.error("Error saving photo:", error);
      toast({
        title: "Fehler",
        description: "Foto konnte nicht gespeichert werden.",
        variant: "destructive"
      });
    }
  };

  // Start or stop the capture sequence
  const toggleCapture = () => {
    if (isCapturing) {
      // Stop capturing
      if (captureIntervalRef.current) {
        window.clearInterval(captureIntervalRef.current);
        captureIntervalRef.current = null;
      }
      toast({
        title: "Aufnahme beendet",
        description: `${photoCount} Fotos aufgenommen.`
      });
    } else {
      // Reset for new capture sequence
      setPhotoCount(0);
      prevImageDataRef.current = null;
      
      // Start capturing at regular intervals
      captureIntervalRef.current = window.setInterval(capturePhoto, 500); // Check every 500ms
      
      toast({
        title: "Aufnahme gestartet",
        description: "Fotosequenz wird aufgenommen."
      });
    }
    
    setIsCapturing(!isCapturing);
  };

  // Helper function to try playing video on user interaction
  const tryPlayVideo = () => {
    if (videoRef.current && (videoRef.current.paused || !hasCameraPermission)) {
      console.log("Manual attempt to play video");
      videoRef.current.play()
        .then(() => {
          console.log("Video started after manual interaction");
          setHasCameraPermission(true);
          setCameraError(null);
        })
        .catch(e => {
          console.error("Manual play attempt failed:", e);
          setCameraError("Kamera konnte nicht gestartet werden. Bitte prüfe die Berechtigungen.");
        });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {/* Camera preview */}
      <div 
        className="relative flex-1 bg-black overflow-hidden" 
        onClick={tryPlayVideo}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        
        {!hasCameraPermission && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-4">
            <CameraOff size={48} className="text-white opacity-50 mb-4" />
            <p className="text-white text-center">
              {cameraError || "Kamera wird initialisiert..."}
            </p>
            <p className="text-white text-sm mt-2 text-center opacity-70">
              Falls das Bild schwarz bleibt:
            </p>
            <ul className="text-white text-sm opacity-70 list-disc pl-6 mt-1">
              <li>Tippe auf den Bildschirm zum aktivieren</li>
              <li>Erlaube den Kamerazugriff in den Einstellungen</li>
              <li>Versuche Safari zu verwenden statt anderer Browser</li>
              <li>Lade die Seite neu</li>
            </ul>
            <Button 
              variant="default" 
              className="mt-4 bg-white text-black hover:bg-gray-200"
              onClick={tryPlayVideo}
            >
              Kamera starten
            </Button>
          </div>
        )}
        
        {/* Off-screen canvas for processing */}
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Photo counter */}
        {isCapturing && hasCameraPermission && (
          <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full flex items-center gap-2">
            <Aperture size={16} />
            <span>{photoCount} Fotos</span>
          </div>
        )}
      </div>
      
      {/* Camera controls */}
      <div className="p-4 bg-black">
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="icon"
            className={`rounded-full w-16 h-16 ${
              isCapturing ? "bg-red-500 text-white" : "bg-white text-black"
            }`}
            onClick={toggleCapture}
            disabled={!hasCameraPermission}
          >
            <Camera size={24} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
