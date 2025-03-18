
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff, Aperture } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const Index = () => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevImageDataRef = useRef<ImageData | null>(null);
  const captureIntervalRef = useRef<number | null>(null);

  // Request camera permission and initialize
  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment", // Use back camera on mobile
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        
        setHasCameraPermission(true);
      } catch (error) {
        console.error("Error accessing camera:", error);
        toast({
          title: "Kamera-Fehler",
          description: "Zugriff auf die Kamera nicht möglich. Bitte erlaube den Kamerazugriff.",
          variant: "destructive"
        });
        setHasCameraPermission(false);
      }
    };

    initCamera();

    return () => {
      // Clean up video stream when component unmounts
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
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

  // Save photo to user's device (browser download in this case)
  const savePhoto = (canvas: HTMLCanvasElement) => {
    try {
      // Convert canvas to blob and create a download link
      canvas.toBlob((blob) => {
        if (!blob) return;
        
        // Create object URL
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
      }, 'image/jpeg', 0.9);
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

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {/* Camera preview */}
      <div className="relative flex-1 bg-black overflow-hidden">
        {hasCameraPermission ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <CameraOff size={48} className="text-white opacity-50" />
            <p className="text-white mt-4">Kein Kamerazugriff</p>
          </div>
        )}
        
        {/* Off-screen canvas for processing */}
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Photo counter */}
        {isCapturing && (
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
