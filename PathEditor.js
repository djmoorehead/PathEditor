const PathEditor = (() => { 
    const version = '0.3';
    const schemaVersion = '0.1';
    const scriptName = 'PathEditor';
    
    const defaultPtSize = 20;
    const minPtSize = 10;
    
    const blackCircleURL = 'https://s3.amazonaws.com/files.d20.io/images/282659898/j37Ju-GdoUwoOt9gqa-7Dw/max.png?1651157146';
    const whiteCircleURL = 'https://s3.amazonaws.com/files.d20.io/images/281433007/1Wg4G-dP-PaiqmQENFKaJA/max.png?1650464535'
    
    const editPtCharName = 'PathEditPt';
    const macroName = 'PathEditMenu';
    
    const getCleanImgsrc = (imgsrc) => {
        let parts = imgsrc.match(/(.*\/images\/.*)(thumb|med|original|max)([^?]*)(\?[^?]+)?$/);
        if(parts) {
            return parts[1]+'thumb'+parts[3]+(parts[4]?parts[4]:`?${Math.round(Math.random()*9999999)}`);
        }
        return;
    };
    
    const checkInstall = () =>  {
        log(`${scriptName} v${version} initialized`);
        
        //delete state[scriptName];
        
        if( ! _.has(state, scriptName) || state[scriptName].version !== schemaVersion) {
            log('  > Updating Schema to v'+schemaVersion+' <');
            switch(state[scriptName] && state[scriptName].version) {
                case 0.1:
                /* falls through */
                case 'UpdateSchemaVersion':
                    state[scriptName].version = schemaVersion;
                    break;

                default:
                    state[scriptName] = {
                        version: schemaVersion,
                        buffer: [],
                        snapToGrid: false
                    };
                    break;
            }
        }
        //log(state[scriptName]);
        
        try {
            let editPtChars = findObjs({
                _type: 'character',
                name: editPtCharName
            }, {caseInsensitive: true}) || [];
            
            if (editPtChars.length === 0) {
                log(`====> From ${scriptName}: The default ${editPtCharName} character does not exist! Creating now.`);
                
                let charObj = {
                    avatar: blackCircleURL,
                    name: editPtCharName,
                    inplayerjournals: 'all',
                    controlledby: 'all'
                }
                let newChar = createObj('character', charObj);
                if (newChar) {
                    let charID = newChar.get('_id');
                    let pageID = Campaign().get("playerpageid")
                    
                    let images = [getCleanImgsrc(blackCircleURL), getCleanImgsrc(whiteCircleURL)];
                    
                    //create/set the default token for the control token character
                    let tokObj = {
                        imgsrc: images[0],
                        sides: images.map(encodeURIComponent).join('|'),
                        represents: charID,
                        name: editPtCharName,
                        width: defaultPtSize,
                        height: defaultPtSize,
                        left: 100,
                        top: 100,
                        isdrawing: true,
                        layer: "objects",
                        pageid: pageID
                    }
                    
                    let newTok = createObj('graphic', tokObj)
                    if (newTok) {
                        setDefaultTokenForCharacter(newChar,newTok);
                        newTok.remove();
                        
                        log(`====> From ${scriptName}:(${editPtCharName}) was created.`);
                        sendChat(scriptName,`/w gm \`\`${scriptName} has created a character named (${editPtCharName}). \`\``)
                    } else {
                        log(`====> From ${scriptName}: Failed to create collections macro (${editPtCharName}).`);
                        sendChat(scriptName,`/w gm \`\`${scriptName} failed to create a character named (${editPtCharName}) \`\``)
                    }
                    
                    //create common abilities for the new character
                    let ability = createObj('ability', {characterid: charID, name: 'Edit', action: '!path_Edit', istokenaction: true});
                    ability = createObj('ability', {characterid: charID, name: 'Done', action: '!path_Done', istokenaction: true});
                    ability = createObj('ability', {characterid: charID, name: 'Split', action: '!path_Split', istokenaction: true});
                    ability = createObj('ability', {characterid: charID, name: 'AddPt', action: '!path_AddPt', istokenaction: true});
                    ability = createObj('ability', {characterid: charID, name: 'DeletePt', action: '!path_DeletePt', istokenaction: true});
                    ability = createObj('ability', {characterid: charID, name: 'OpenPolygon', action: '!path_Open', istokenaction: true});
                    ability = createObj('ability', {characterid: charID, name: 'ClosePolygon', action: '!path_Close', istokenaction: true});
                    ability = createObj('ability', {characterid: charID, name: 'Pt_ToggleColor', action: '!path_TogglePt', istokenaction: true});
                    ability = createObj('ability', {characterid: charID, name: 'Pt_ToggleGridSnap', action: '!path_Snap', istokenaction: true});
                    ability = createObj('ability', {characterid: charID, name: 'Pt_SetSize', action: '!path_ResizePt ?{Enter size in pixels|20}', istokenaction: true});
                    ability = createObj('ability', {characterid: charID, name: 'Pt_Shrink', action: '!path_ResizePt decrease', istokenaction: true});
                    ability = createObj('ability', {characterid: charID, name: 'Pt_Grow', action: '!path_ResizePt increase', istokenaction: true});
                }
            } else {
                //controlPt character already exists, check for new abilities
                let charID = editPtChars[0].get('_id');
                let simplifyAbility = findObjs({
                                            _type: 'ability',
                                            _characterid: charID,
                                            name: 'SimplifyPath'
                                        }, {caseInsensitive: true}) || [];
                if (simplifyAbility.length === 0) {
                    let ability = createObj('ability', {characterid: charID, name: 'SimplifyPath', action: '!path_Simplify ?{Enter tolerance in pixels|5}', istokenaction: true});
                }
            }
            
            let menuMacros = findObjs({
                _type: 'macro',
                name: macroName
            }, {caseInsensitive: true}) || [];
            
            let actionText = `/w gm /w gm &{template:default}{{name=Path Editor Menu}} {{***START/STOP***\n` +
                                    `*(Select path to begin editing)*\n` +
                                    `[EDIT](~PathEditPt|Edit) [DONE](~PathEditPt|Done)\n\n` +
                                    `***REQUIRES 1 PT SELECTED***\n` +
                                    `[ADD PT](~PathEditPt|AddPt) [DELETE PT](~PathEditPt|DeletePt)\n\n` +
                                    `***REQUIRES 1+ PTS SELECTED***\n` +
                                    `[SPLIT](~PathEditPt|Split)\n\n` +
                                    `***CONTROL PT OPTIONS***\n` +
                                    `*(No Selection Required)*\n` +
                                    `[SHRINK](~PathEditPt|Pt_Shrink) [GROW](~PathEditPt|Pt_Grow) [SET SIZE](~PathEditPt|Pt_SetSize) [TOGGLE COLOR](~PathEditPt|Pt_ToggleColor) [TOGGLE GRID SNAPPING](~PathEditPt|Pt_ToggleGridSnap)\n\n` +
                                    `***PATH FUNCTIONS***\n` +
                                    `*(Select path before running)*\n` +
                                    `[OPEN](~PathEditPt|OpenPolygon) [CLOSE](~PathEditPt|ClosePolygon) [SIMPLIFY](~PathEditPt|SimplifyPath)\n` +
                                `}}`
            if (menuMacros.length === 0) {
                log(`====> From ${scriptName}: Creating collections macro: ${macroName}`);
                
                
                let players = findObjs({_type:"player"}).filter(p => playerIsGM(p.get('_id')));
                let gmID = players[0].get('_id');
                
                let macro = createObj('macro', {playerid: gmID, name: macroName, visibleto: gmID, action: actionText})
                
                if(macro) {
                    log(`====> From ${scriptName}: Collections macro (${macroName}) was created.`);
                    sendChat(scriptName,`/w gm \`\`${scriptName} has created a collections macro named (${macroName}). \`\``)
                } else {
                    log(`====> From ${scriptName}: Failed to create collections macro (${macroName}).`);
                    sendChat(scriptName,`/w gm \`\`${scriptName} failed to create a collections macro named (${macroName}) \`\``)
                }
            } else {
                //macro already exists, update the action text
                menuMacros[0].set('action', actionText)
            }
        }
        catch(err) {
            sendChat(scriptName, '/w gm Unhandled Error: ' + err.message);
        }
    };
    
    const clearCache = function() {
        state[scriptName].buffer.pathID = '';
        state[scriptName].buffer.closedPoly = '';
        state[scriptName].buffer.controlToks = [];
    }
    
    const commit = function() {
        let controlToks = state[scriptName].buffer.controlToks;
        if (controlToks) {
            for (let i=0; i<controlToks.length; i++) {
                let tok = getObj('graphic', controlToks[i].id);
                if (tok) {
                    tok.remove();
                }
            }
            clearCache();
        }
    }
    
    const makePathEditLink = function(pathID, controlToks, closedPoly) {
        let link =  {
            pathID: pathID,
            closedPoly: closedPoly,
            controlToks: controlToks        //array of [{tokID1, x, y}, {tokID2, x, y}...etc]
        };
        
        state[scriptName].buffer = link;
        return link;
    }
    
    const getControlPtIndex = function(tokID) {
        let retVal = undefined;
        let controlToks = state[scriptName].buffer.controlToks;
        if (controlToks) {
            for (let i=0; i<controlToks.length; i++) {
                if (controlToks[i].id === tokID) {
                    return i
                }
            }
        }
        
        return retVal;
    }
    
    async function createNewPathObj (basePathObj, controlToks, closedPoly) {
        try {
            let pathObjCopy = JSON.parse(JSON.stringify(basePathObj));;
                
            let rot = pathObjCopy.rotation;
            
            let ptsMap = [];    //control pts in map coord system
            let ptsPath = [];   //control pts in path coord system
            
            let minX = 999999;
            let minY = 999999;
            let maxX = -999999;
            let maxY = -999999;
            controlToks.forEach(tok => {
                if (tok.x > maxX) { maxX = tok.x }
                if (tok.x < minX) { minX = tok.x }
                if (tok.y > maxY) { maxY = tok.y }
                if (tok.y < minY) { minY = tok.y }
                
                let thisPt = new pt(tok.x, tok.y);
                ptsMap.push(thisPt)
                
                //update the xy of controlToks. will write to state object later
                tok.x = thisPt.x;
                tok.y = thisPt.y;
            });
            
            let w = maxX - minX;
            let h = maxY - minY;
            let center = new pt(minX+w/2, minY+h/2);
            
            //convert map coords to path coords with new path location & dimensions
            for (let i=0; i<ptsMap.length; i++) {
                ptsPath.push(convertPtMapToPathCoords(ptsMap[i], center, w, h))
            }
            
            let newPath = buildPolyLinePath(ptsPath, closedPoly);
            //log(newPath)
            
            //remove rotatio. Since we are making a new path from map coords it is not necessary
            pathObjCopy.rotation = 0;
            pathObjCopy.scaleX = 1;
            pathObjCopy.scaleY = 1;
            pathObjCopy._path = newPath;
            pathObjCopy.width = w;
            pathObjCopy.height = h;
            pathObjCopy.left = center.x;
            pathObjCopy.top = center.y;
            
            let newPathObj = await createObj('path',pathObjCopy);
            
            return newPathObj;
        }
        catch(err) {
          sendChat(scriptName, '/w gm Unhandled exception: ' + err.message)
        }
    }
    
    function pathEditor_handleRemovePath (obj) {
        if (obj.get("_id") === state[scriptName].buffer.pathID) {
            commit();
        }
    }    
    
    async function pathEditor_handleObjChange (obj,prev) {
        try {
            let moveMode = obj.get('left') !== prev.left || obj.get('top') !== prev.top;
            let resizeMode = obj.get('width') !== prev.width || obj.get('height') !== prev.height
            //only trigger when token is moved or resized
            //if ( (obj.get('left') === prev.left && obj.get('top') === prev.top) && (obj.get('width') === prev.width && obj.get('height') === prev.height)) {
            if (!moveMode && !resizeMode) {
                return;
            }
            
            let controlPtIndex;
            
            let type = obj.get('_type');
            
            if (type !== 'graphic' && type !== 'path') {
                return;
            }
            
            let id = obj.get('id');
            
            //Get info from state object
            let controlToks = state[scriptName].buffer.controlToks;
            if (controlToks.length === 0) {
                return;
            }
            let closedPoly = state[scriptName].buffer.closedPoly
            let pathObj = getObj('path', state[scriptName].buffer.pathID);
            let snapToGrid = state[scriptName].snapToGrid;
            
            if (type === 'graphic') {
                controlPtIndex = getControlPtIndex(id);
                
                if (controlPtIndex !== undefined) {
                    
                    if (resizeMode) {
                        obj.set({width: prev.width, height: prev.height, left: prev.left, top: prev.top});
                        return;
                    }
                    
                    if (snapToGrid) {
                        //moves tok to nearest intersection & updates the controlToks state element
                        snapToIntersection(obj, controlToks[controlPtIndex]);
                    } else {
                        //update state array: controlTok position
                        controlToks[controlPtIndex].x = obj.get('left');
                        controlToks[controlPtIndex].y = obj.get('top');
                    }
                    
                    let newPathObj = await createNewPathObj(pathObj, controlToks, closedPoly);
                    
                    let newLink = makePathEditLink(newPathObj.get("_id"), controlToks, closedPoly)
                    if (newLink) {
                        pathObj.remove();
                    }
                }
            } else if (type === 'path') {
                if (id !== pathObj.get('_id')) {
                    return;
                }
                
                let dX = obj.get('left') - prev.left;
                let dY = obj.get('top') - prev.top;
                
                controlToks.forEach(t => {
                    let tok = getObj('graphic', t.id);
                    let newX = tok.get('left') + dX;
                    let newY = tok.get('top') + dY;
                    
                    t.x = newX;
                    t.y = newY;
                    
                    tok.set({left: newX, top: newY});
                })
            }
        }
        catch(err) {
          sendChat(scriptName, '/w gm Unhandled exception: ' + err.message)
        }
    }

    
    //Creates closed or open polygonal line path JSON.
    const buildPolyLinePath = function(pts, closed) {
        if (Object.prototype.toString.call(pts) === '[object Array]') {
            let pathJSON = '';
            pts.forEach((p) => {
                if (p.x !== null && p.y !== null) {
                    if (pathJSON === '') {
                        pathJSON = `[[\"M\",${p.x},${p.y}],`;
                    } else {
                        pathJSON += `[\"L\",${p.x},${p.y}],`;
                    }
                }
            });
           
            
            if (closed === true) { 
                pathJSON += `[\"L\",${pts[0].x},${pts[0].y}],[\"Z\"]]`; 
            } else {
                //replace trailing comma with closing square bracket
                pathJSON = pathJSON.replace(/.$/,"]")
            }
            return pathJSON;
        }
        return null;
    }
    
    const pt = function(x,y) {
        this.x = x,
        this.y = y
    };
    
    //returns character object for given name
    const getCharacterFromName = function (charName) {
        let character = findObjs({
            _type: 'character',
            name: charName
        }, {caseInsensitive: true})[0];
        return character;
    };
    
    // Send this function a decimal sRGB gamma encoded color value
    // between 0.0 and 1.0, and it returns a linearized value.
    const sRGBtoLin = function(colorChannel) {
        if ( colorChannel <= 0.04045 ) {
            return colorChannel / 12.92;
        } else {
            return Math.pow((( colorChannel + 0.055)/1.055),2.4);
        }
    }
    
    // Send this function a luminance value between 0.0 and 1.0,
        // and it returns L* which is "perceptual lightness"
    const luminanceToLstar = function(Y) {
        if ( Y <= (216/24389) ) {       // The CIE standard states 0.008856 but 216/24389 is the intent for 0.008856451679036
            return Y * (24389/27);  // The CIE standard states 903.3, but 24389/27 is the intent, making 903.296296296296296
        } else {
            return Math.pow(Y,(1/3)) * 116 - 16;
        }
    }
    
    const getEditColor = function(hex) {
        //calc RGB, normalized to 1 (i.e. 0 to 255 becomes 0 to 1)
        let r = parseInt(hex.slice(1, 3), 16) / 255;
        let g = parseInt(hex.slice(3, 5), 16) / 255;
        let b = parseInt(hex.slice(5, 7), 16) / 255;
        
        //calc luminance
        let luminance = (0.2126 * sRGBtoLin(r) + 0.7152 * sRGBtoLin(g) + 0.0722 * sRGBtoLin(b));
        
        //calc greyscale brightness (L* from the L*a*b* color coordinate system, ranges from 0 to 100 so 50 is medium grey)
        let Lstar = luminanceToLstar(luminance);
        if (Lstar >= 50) {
            return '#000000';
        } else {
            return '#FFFFFF';
        }
    }
    
    const  degreesToRadians = function (degrees) {
      var pi = Math.PI;
      return degrees * (pi/180);
    }
    
    //cx, cy = coordinates of the center of rotation
    //angle = clockwise rotation angle
    //p = point object
    const rotatePoint = function (cX,cY,angle, p){
        s = Math.sin(angle);
        c = Math.cos(angle);
        
        // translate point back to origin:
        //   first make a deep copy of the point object to avoid altering the original
        let pCopy = JSON.parse(JSON.stringify(p));
        pCopy.x -= cX;
        pCopy.y -= cY;
        
        // rotate point
        newX = pCopy.x * c - pCopy.y * s;
        newY = pCopy.x * s + pCopy.y * c;
        
        // translate point back:
        pCopy.x = newX + cX;
        pCopy.y = newY + cY;
        return pCopy;
    }
    
    //***************************************************************************************
    //  These functions are used for Ramer-Douglas-Peucker polyline simplification algorithm
    //      copied from https://github.com/mourner/simplify-js/blob/master/simplify.js
    //***************************************************************************************
    // square distance between 2 points
    function getSqDist(p1, p2) {
        var dx = p1.x - p2.x,
            dy = p1.y - p2.y;
    
        return dx * dx + dy * dy;
    }
    
    // square distance from a point to a segment
    function getSqSegDist(p, p1, p2) {
        var x = p1.x,
            y = p1.y,
            dx = p2.x - x,
            dy = p2.y - y;
    
        if (dx !== 0 || dy !== 0) {
    
            var t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
    
            if (t > 1) {
                x = p2.x;
                y = p2.y;
            } else if (t > 0) {
                x += dx * t;
                y += dy * t;
            }
        }
    
        dx = p.x - x;
        dy = p.y - y;
    
        return dx * dx + dy * dy;
    }
    
    // basic distance-based simplification
    function simplifyRadialDist(points, sqTolerance) {
        var prevPoint = points[0],
            newPoints = [prevPoint],
            point;
    
        for (var i = 1, len = points.length; i < len; i++) {
            point = points[i];
    
            if (getSqDist(point, prevPoint) > sqTolerance) {
                newPoints.push(point);
                prevPoint = point;
            }
        }
    
        if (prevPoint !== point) newPoints.push(point);
    
        return newPoints;
    }
    
    function simplifyDPStep(points, first, last, sqTolerance, simplified) {
        var maxSqDist = sqTolerance,
            index;
    
        for (var i = first + 1; i < last; i++) {
            var sqDist = getSqSegDist(points[i], points[first], points[last]);
    
            if (sqDist > maxSqDist) {
                index = i;
                maxSqDist = sqDist;
            }
        }
    
        if (maxSqDist > sqTolerance) {
            if (index - first > 1) simplifyDPStep(points, first, index, sqTolerance, simplified);
            simplified.push(points[index]);
            if (last - index > 1) simplifyDPStep(points, index, last, sqTolerance, simplified);
        }
    }
    
    // simplification using Ramer-Douglas-Peucker algorithm
    function simplifyDouglasPeucker(points, sqTolerance) {
        var last = points.length - 1;
    
        var simplified = [points[0]];
        simplifyDPStep(points, 0, last, sqTolerance, simplified);
        simplified.push(points[last]);
    
        return simplified;
    }
    
    // both algorithms combined for awesome performance
    function simplify(points, tolerance, highestQuality) {
    
        if (points.length <= 2) return points;
    
        var sqTolerance = tolerance !== undefined ? tolerance * tolerance : 1;
    
        points = highestQuality ? points : simplifyRadialDist(points, sqTolerance);
        points = simplifyDouglasPeucker(points, sqTolerance);
    
        return points;
    }
    //***************************************************************************************
    //  End of functions used for Ramer-Douglas-Peucker polyline simplification algorithm
    //***************************************************************************************
    

    //controlArray will look like ["M",0,0] or ["L",0,35] or ["Q",0,0,70,105], etc
    //This function grabs the control point from each array, which is the last two coordinates of the controlArray argument
        //converts from relative path coords to absolute map coords
    const convertPtPathToMapCoords = function(controlArray, center, w, h, rot, scaleX, scaleY) {
        let len = controlArray.length;
        let point = new pt(controlArray[len-2], controlArray[len-1]);
        
        //translate relative x,y (path) to actual x,y (map) 
        point.x = scaleX*point.x + center.x - (scaleX * w/2);
        point.y = scaleY*point.y + center.y - (scaleY * h/2);
        
        point = rotatePoint(center.x, center.y, rot, point)
          
        return point;
    }
    
    const convertPtMapToPathCoords = function(point, center, w, h) {
        // first make a deep copy of the point object to avoid altering the original
        let pointCopy = JSON.parse(JSON.stringify(point));
        
        let newPointX = pointCopy.x - center.x + w/2;
        let newPointY = pointCopy.y - center.y + h/2;
        
        let newPoint = new pt(newPointX, newPointY);
        
        return newPoint;
    }

    async function spawnTokenAtXY (tokenJSON, pageID, spawnX, spawnY, size, controlledby, isDrawing, currentSideNew, layer) {
        let controlTok;
        let imgsrc;
        let sides;
        let sidesArr;
        
        try {
            let baseObj = JSON.parse(tokenJSON);
            
            //set token properties
            baseObj.pageid = pageID;
            baseObj.left = spawnX;
            baseObj.top = spawnY;
            baseObj.width = size;
            baseObj.height = size;
            baseObj.controlledby = controlledby;
            baseObj.isdrawing = isDrawing;
            baseObj.layer = layer;
            
            baseObj.imgsrc = getCleanImgsrc(baseObj.imgsrc); //ensure that we're using the thumb.png
            
            //image must exist in personal Roll20 image library 
            if (baseObj.imgsrc ===undefined) {
                sendChat(scriptName,`/w gm Unable to find imgsrc for default token of \(${baseObj.name}\)<br> You must use an image file that has been uploaded to your Roll20 Library.`)
                return;
            }
            
            if (baseObj.hasOwnProperty('sides')) {
                sidesArr=baseObj["sides"].split('|');
    
                if ( (currentSideNew !== -999) && (sidesArr[0] !== '') ) {
                    
                    //check for random side
                    if ( isNaN(currentSideNew) ) {
                        currentSideNew = randomInteger(sidesArr.length) - 1;    // Setting to random side. currentSide is 1-based for user
                    } else {
                        currentSideNew = parseInt(currentSideNew) - 1;          //currentSide is 1-based for user
                    }
                    
                    //set the current side (wtih data validation for the requested side)
                    if ( (currentSideNew > 0) || (currentSideNew <= sidesArr.length-1) ) {
                        newSideImg = getCleanImgsrc(sidesArr[currentSideNew]);     //URL of the image
                        baseObj["currentSide"] = currentSideNew;
                        baseObj["imgsrc"] = newSideImg;
                    } else {
                        sendChat(scriptName,`/w gm Error: Requested index of currentSide is invalid`);
                        return retVal;
                    }
                }
            }
            
            controlTok = await createObj('graphic',baseObj);
            toFront(controlTok)
            return controlTok;
        }
        catch(err) {
          sendChat(scriptName, '/w gm Unhandled exception: ' + err.message)
        }
    };
    
    const isNumber = function isNumber(value) {
        return typeof value === 'number' && isFinite(value);
    }
    
    const distBetweenPts = function(pt1, pt2, calcType='Euclidean', gridIncrement=-999, scaleNumber=-999) {
        let distPx;     //distance in Pixels
        let distUnits;  //distance in units (gridded maps only)
        if (calcType === 'PF' && gridIncrement !== -999 & scaleNumber !== -999) {
            //using 'Pathfinder' distance rules, where every other diagonal unit counts as 1.5 units. 
            //..or using 5e diagonal rules where each diag only counts 1 square. 
            //..5e is special due to how t is constructed. We use Euclidean distance to determine if in cone, but we can display in 5e units. 
                //Only compatible with gridded maps
                //convert from pixels to units, do the funky pathfinder math, then convert back to pixels
            let dX = (Math.abs(pt1.x - pt2.x) * scaleNumber / 70) / gridIncrement;
            let dY = (Math.abs(pt1.y - pt2.y) * scaleNumber / 70) / gridIncrement;
            let maxDelta = Math.max(dX, dY);
            let minDelta = Math.min(dX, dY);
            let minFloor1pt5Delta;
            if (calcType === 'PF') {
                //every other diagonal counts as 1.5 squares
                minFloor1pt5Delta = Math.floor(1.5 * minDelta);
            }
            let temp = Math.floor( (maxDelta-minDelta + minFloor1pt5Delta) / scaleNumber ) * scaleNumber
            
            //convert dist back to pixels
            distUnits = Math.floor( (maxDelta-minDelta + minFloor1pt5Delta) / scaleNumber ) * scaleNumber
            distPx = distUnits * 70 * gridIncrement / scaleNumber; 
            
        } else {
            //default Pythagorean theorem
            distPx = Math.sqrt( Math.pow(pt1.x - pt2.x, 2) + Math.pow(pt1.y - pt2.y, 2) );
        }
        
        return distPx;
    }
    
    const getClosestGridPt = function(testPt, ptArray, pageGridIncrement) {
        //first, filter out points in the master array that are farther than 1 unit away
        let arr = ptArray.filter(pt => {
            if (pt.x <= testPt.x+70*pageGridIncrement && pt.x >= testPt.x-70*pageGridIncrement && 
                pt.y <= testPt.y+70*pageGridIncrement && pt.y >= testPt.y-70*pageGridIncrement) {
                return true;
            }
        });
        
        let minDist = 99999;
        let d, idx;
        arr.forEach((pt, i) => {
            d = distBetweenPts(pt, testPt);
            if (d < minDist) {
                minDist = d;
                idx = i;
            }
        });
        return arr[idx];
    }
    
    const snapToIntersection = function (tok, controlToksElement=0) {
        let pageID = tok.get('_pageid');
        let page = getObj("page", pageID);
        let pageGridIncrement = page.get('snapping_increment')
        let pageWidthPx = page.get('width')*70;
        let pageHeightPx = page.get('height')*70;
        
        let intersections = [];
        for (let i=0; i<=pageWidthPx; i+=70*pageGridIncrement) {
            for (let j=0; j<=pageHeightPx; j+=70*pageGridIncrement) {
                intersections.push(new pt(i, j))
            }
        }
        
        let tokPt = new pt(tok.get('left'), tok.get('top'))
        let newPt = getClosestGridPt(tokPt, intersections, pageGridIncrement)
        
        //grab the previous token settings before setting new ones
        let prevTok = JSON.parse(JSON.stringify(tok));
        //set new tok settings
        tok.set({left:newPt.x, top:newPt.y})
        
        //update state array: controlTok position
        controlToksElement.x = newPt.x;
        controlToksElement.y = newPt.y;
    }
    
    async function pathEditor_HandleInput(msg) {
        
        //******************************************************************************************************
        //HARDCODED BEZIER CURVE TESTING
        //******************************************************************************************************
        /*
        if (msg.type === "api" && msg.content.toLowerCase().indexOf("!pathtemp")==0) {
            let pathObj = getObj('path', state[scriptName].buffer.pathID);
            
            let pathObjCopy = JSON.parse(JSON.stringify(pathObj));;
            
            pathObjCopy._path = `[[\"M",0,0],[\"Q\",140,70,70,140],[\"L\",210,210]]`;
            pathObjCopy.width = 210;
            pathObjCopy.height = 210;
            createObj("path", pathObjCopy);
        }
        */
        
        //******************************************************************************************************
        //RESIZES control pts
        //******************************************************************************************************
        if (msg.type === "api" && msg.content.toLowerCase().indexOf("!path_resizept")==0) {
            try {
                let sizeParam;
                let controlToks = state[scriptName].buffer.controlToks;
                
                if (controlToks) {
                    let cmd = msg.content.split(" ").map(e => e.toLowerCase());
                    if (cmd.length < 2) {
                        sendChat(scriptName, '/w gm Wrong number of arguments for resize command. Syntax is !path_ResizePt <increase/decrease/#>');
                    }
                    
                    if (isNumber(parseInt(cmd[1]))) {
                        sizeParam = parseInt(cmd[1]);
                        controlToks.forEach(e => {
                            let tok = getObj('graphic',e.id);
                            if (tok) {
                                tok.set({width: sizeParam, height: sizeParam});
                            }
                        });
                    } else {
                        sizeParam = cmd[1]==='decrease' ? -10 : 10;
                        controlToks.forEach(e => {
                            let tok = getObj('graphic',e.id);
                            if (tok) {
                                let currentSize = tok.get('width');
                                let newSize;
                                newSize = Math.max(currentSize + sizeParam, minPtSize);
                                tok.set({width: newSize, height: newSize});
                            }
                        });
                    }
                }
            }
            catch(err) {
                sendChat(scriptName, '/w gm Unhandled Error: ' + err.message);
            }
        }
        
        //******************************************************************************************************
        //TOGGLES COLOR of control pts (changes side of rollable table token)
        //******************************************************************************************************
        if (msg.type === "api" && msg.content.toLowerCase().indexOf("!path_togglept")==0) {
            try {
                let controlToks = state[scriptName].buffer.controlToks;
                
                if (controlToks) {
                    controlToks.forEach(e => {
                        let tok = getObj('graphic',e.id);
                        if (tok) {
                            let sides = tok.get('sides').split('|');
                            let currentSide = tok.get('currentSide');
                            let newSide = (currentSide+1) % sides.length;
                            
                            let newSideImg = getCleanImgsrc(sides[newSide]);     //URL of the image
                            tok.set({currentSide: newSide, imgsrc:newSideImg});
                        }
                    });
                }
            }
            catch(err) {
                sendChat(scriptName, '/w gm Unhandled Error: ' + err.message);
            }
        }
        
        //******************************************************************************************************
        //CONVERTS a closed path to an open path
        //******************************************************************************************************
        if (msg.type === "api" && msg.content.toLowerCase().indexOf("!path_open")==0) {
            try {
                let selected = msg.selected.filter(e => e._type==='path');
                
                if (selected.length === 0) {
                    sendChat(scriptName, '/w gm You must first select a path to proceed.');
                    return;
                } else {
                    let statePathID = state[scriptName].buffer.pathID;
                    let statePathObj = getObj('path', statePathID);
                    let editMode = statePathObj ? true : false;
                    let pathObj;
                    if (editMode) {
                        pathObj = getObj('path', statePathID);
                    } else {
                        pathObj = getObj('path', selected[0]._id);
                    }
                    
                    let pathArr = JSON.parse(pathObj.get("path"));
                    let closedPoly = pathArr.find(e => e[0] === 'Z') ? true : false;
                    if (closedPoly) {
                        let openPath = pathArr.filter(e => e[0] !== 'Z');
                        let pathObjCopy = JSON.parse(JSON.stringify(pathObj));
                        pathObjCopy._path = JSON.stringify(openPath);
                        let newPathObj = await createObj('path',pathObjCopy);
                        
                        if (newPathObj) {
                            if (editMode) {
                                let controlToks = state[scriptName].buffer.controlToks;
                                let newLink = makePathEditLink(newPathObj.get("_id"), controlToks, false)
                            }
                            pathObj.remove();
                        }
                    }
                }
            }
            catch(err) {
                sendChat(scriptName, '/w gm Unhandled Error: ' + err.message);
            }
        }
        
        //******************************************************************************************************
        //CONVERTS an open path to a closed path
        //******************************************************************************************************
        if (msg.type === "api" && msg.content.toLowerCase().indexOf("!path_close")==0) {
            try {
                let selected = msg.selected.filter(e => e._type==='path');
                
                if (selected.length === 0) {
                    sendChat(scriptName, '/w gm You must first select a path to proceed.');
                    return;
                } else {
                    let pathObj = getObj('path', selected[0]._id);
                    let pathArr = JSON.parse(pathObj.get("path"));
                    let closedPoly = pathArr.find(e => e[0] === 'Z') ? true : false;
                    if (closedPoly===false) {
                        let closedPath = JSON.parse(JSON.stringify(pathArr));
                        closedPath.push(pathArr[0]);
                        closedPath[closedPath.length-1][0] = 'L';
                        closedPath.push(['Z']);
                        let pathObjCopy = JSON.parse(JSON.stringify(pathObj));
                        pathObjCopy._path = JSON.stringify(closedPath);
                        let newPathObj = await createObj('path',pathObjCopy);
                        
                        if (newPathObj) {
                            let statePathObj = getObj('path', state[scriptName].buffer.pathID);
                            let editMode = statePathObj ? true : false; 
                            if (editMode) {
                                let controlToks = state[scriptName].buffer.controlToks;
                                let newLink = makePathEditLink(newPathObj.get("_id"), controlToks, true)
                            }
                            pathObj.remove();
                        }
                    }
                }
            }
            catch(err) {
                sendChat(scriptName, '/w gm Unhandled Error: ' + err.message);
            }
        }
        
        //******************************************************************************************************
        //ADDS a pt between two selected control pts
        //******************************************************************************************************
        if (msg.type === "api" && msg.content.toLowerCase().indexOf("!path_addpt")==0) {
            try {
                //ignore accidental path selections
                let selected = msg.selected.filter(e => e._type==='graphic');
                
                let closedPoly = state[scriptName].buffer.closedPoly;
                let origPathObj = getObj('path', state[scriptName].buffer.pathID);
                let controlToks = state[scriptName].buffer.controlToks;
                
                //initial error checking
                if (!origPathObj) {
                    sendChat(scriptName,`/w gm Error: You cannot add a pt to a path that is not being actively edited. First select a path and run the \`\`!path_edit\`\` command.`);
                    return;
                }
                
                let path = JSON.parse(origPathObj.get("path"));
                let center = new pt(origPathObj.get("left"), origPathObj.get("top"));
                let w = origPathObj.get("width");
                let h = origPathObj.get("height");
                let rot = degreesToRadians(origPathObj.get("rotation"));
                let scaleX = origPathObj.get("scaleX");
                let scaleY = origPathObj.get("scaleY");
                let pageID = origPathObj.get("pageid");
                let layer = origPathObj.get("layer");
                let pathColor = origPathObj.get("stroke");
                let editTokColor = getEditColor(pathColor);
                let editTokSide = editTokColor==='#000000' ? 1 : 2;
                
                //more error checking
                if (!selected) {
                    sendChat(scriptName,`/w gm Error: In order to add a pt to a path you must select TWO ADJACENT control pts.`);
                    return;
                } else if (selected.length !== 2) {
                    sendChat(scriptName,`/w gm Error: In order to add a pt to a path you must select TWO ADJACENT control pts.`);
                    return;
                }
                let controlPtIndices = [];
                selected.forEach(tok => {
                    let idx = getControlPtIndex(tok._id);
                    controlPtIndices.push(idx);
                });
                
                if (controlPtIndices.includes(undefined)) {
                    sendChat(scriptName,`/w gm Error: Invalid selection. Both selected tokens must be valid control pts.`);
                    return;
                }
                
                controlPtIndices.sort();
                let deltaIndex = controlPtIndices[1] - controlPtIndices[0];
                if (deltaIndex !== 1 && deltaIndex !== controlToks.length-1) {
                    sendChat(scriptName,`/w gm Error: In order to add a pt to a path you must select TWO ADJACENT control pts.`);
                    return;
                }
                
                let toks = [];
                selected.forEach(sel => {
                    let tok = getObj('graphic', sel._id);
                    toks.push(tok);
                });
                let newX = (toks[0].get('left') + toks[1].get('left')) / 2;
                let newY = (toks[0].get('top') + toks[1].get('top')) / 2;
                let newPt = new pt(newX, newY);
                
                let spawnObj = getCharacterFromName(editPtCharName);
                spawnObj.get("_defaulttoken", async function(defaultToken) {
                    let newTok = await spawnTokenAtXY(defaultToken, pageID, newPt.x, newPt.y, defaultPtSize, 'all', true, editTokSide, layer);
                    let newControlTok = {
                        id: newTok.get("_id"),
                        x: newPt.x,
                        y: newPt.y
                    }
                    
                    let newPathEntryCoord = convertPtMapToPathCoords(newPt, center, w, h);
                    let newPathEntry = ["L", newPathEntryCoord.x, newPathEntryCoord.y]
                    
                    if (deltaIndex === 1) {
                        //adjacent pts without wrapping
                        controlToks.splice(controlPtIndices[1], 0, newControlTok);
                        path.splice(controlPtIndices[1], 0, newPathEntry);
                    } else {
                        //"adjacent" pts, but one is first path vertex and other is last path vertex
                        controlToks.push(newControlTok);
                        path.push(newPathEntry);
                    }
                    
                    let pathObjCopy = JSON.parse(JSON.stringify(origPathObj));
                    pathObjCopy._path = JSON.stringify(path);
                    
                    let newPathObj = await createObj('path',pathObjCopy);
                    
                    let link = makePathEditLink(newPathObj.get("_id"), controlToks, closedPoly)
                    origPathObj.remove();
                });
            }
            catch(err) {
                sendChat(scriptName, '/w gm Unhandled Error: ' + err.message);
            }
        }
        
        //******************************************************************************************************
        //DELETES one or more selected control pts
        //******************************************************************************************************
        if (msg.type === "api" && msg.content.toLowerCase().indexOf("!path_deletept")==0) {
            try {
                let tokObj;
                //ignore accidental path selections
                let selected = msg.selected.filter(e => e._type==='graphic');
                
                let closedPoly = state[scriptName].buffer.closedPoly;
                let origPathObj = getObj('path', state[scriptName].buffer.pathID);
                let controlToks = state[scriptName].buffer.controlToks;
                
                //initial error checking
                if (!origPathObj) {
                    sendChat(scriptName,`/w gm Error: You cannot delete a pt from a path that is not being actively edited. First select a path and run the \`\`!path_edit\`\` command.`);
                    return;
                }
                
                let path = JSON.parse(origPathObj.get("path"));
                
                let controlPtIndices = [];
                selected.forEach(tok => {
                    let idx = getControlPtIndex(tok._id);
                    if (idx) {
                        controlPtIndices.push(idx);
                        tokObj = getObj('graphic', tok._id);
                        //tokObj.remove();
                    }
                });
                
                if (controlPtIndices.length===0) {
                    sendChat(scriptName,`/w gm Error: Invalid selection. All selected tokens must be valid control pts.`);
                    return;
                }
                
                controlPtIndices.sort();
                
                //remove the selected indices from controlToks
                let newControlToks = controlToks.filter((e, idx) => {
                    return !controlPtIndices.includes(idx);
                });
                
                //remove the selected indices from the Path array
                let newPath = path.filter((e, idx) => {
                    return !controlPtIndices.includes(idx);
                });
                
                //let pathObjCopy = JSON.parse(JSON.stringify(origPathObj));
                //pathObjCopy._path = JSON.stringify(newPath);
                
                let newPathObj = await createNewPathObj(origPathObj, newControlToks, closedPoly);
                
                let link = makePathEditLink(newPathObj.get("_id"), newControlToks, closedPoly)
                
                origPathObj.remove();
                tokObj.remove();
            }
            catch(err) {
                sendChat(scriptName, '/w gm Unhandled Error: ' + err.message);
            }
        }
        
        //******************************************************************************************************
        //SPLITS the path at one or more control pts
        //******************************************************************************************************
        if (msg.type === "api" && msg.content.toLowerCase().indexOf("!path_split")==0) {
            
            try {
                
                //ignore accidental path selections
                let selected = msg.selected.filter(e => e._type==='graphic');
                
                let closedPoly = state[scriptName].buffer.closedPoly;
                let origPathObj = getObj('path', state[scriptName].buffer.pathID);
                let controlToks = state[scriptName].buffer.controlToks;
                
                //initial error checking
                if (!selected) {
                    sendChat(scriptName,`/w gm Error: You must select one or more control points of an actively edited path to proceed.`);
                } else if (!origPathObj) {
                    sendChat(scriptName,`/w gm Error: You cannot split a path that is not being actively edited. Select a path and run the \`\`\`!path_edit\`\`\` command.`);
                    return;
                } else if (closedPoly === true && selected.length !== 2) {
                    sendChat(scriptName,`/w gm Error: In order to split a closed polygon you must select TWO control pts.`);
                    return;
                //} else if (closedPoly === false && selected.length !== 1) {
                //    sendChat(scriptName,`/w gm Error: In order to split an open polygon you must select only ONE control pt.`);
                //    return;
                }
                
                let controlPtIndices = [];
                selected.forEach(tok => {
                    let idx = getControlPtIndex(tok._id);
                    controlPtIndices.push(idx);
                });
                
                if (controlPtIndices.includes(undefined)) {
                    sendChat(scriptName,`/w gm Error: Invalid selection. All selected tokens must be valid control pts.`);
                    return;
                }
                
                controlPtIndices.sort();
                
                if (closedPoly === false) {
                    //handle open polygon
                    //split the open polygon into pieces. Uses original path ordering of vertices
                    let startingIndex = 0;
                    for (let i=0; i<controlPtIndices.length; i++) {
                        if (controlPtIndices[i] !== 0) {
                            let tokSubset = controlToks.slice(startingIndex, controlPtIndices[i]+1);
                            let newPathObj = createNewPathObj(origPathObj, tokSubset, closedPoly);
                            startingIndex = controlPtIndices[i];
                        }
                    }
                    
                    //perform one final path creation with remaining points (from last control pt to end of original path)
                    if (startingIndex < controlToks.length) {
                        let toksSubset = controlToks.slice(startingIndex, controlToks.length);
                        let newPathObj = createNewPathObj(origPathObj, toksSubset, closedPoly);
                    }
                    
                    origPathObj.remove();
                    commit();
                } else {
                    closedPoly = false;
                    //handle closed polygon. At this point we have exactly two valid control pts selected
                   
                    // append controlToks to itself
                    let repeatControlToks = controlToks.concat(controlToks);
                    
                    //Form two new paths
                    let tokSubset = repeatControlToks.slice(controlPtIndices[0], controlPtIndices[1]+1);
                    let newPathObj = createNewPathObj(origPathObj, tokSubset, closedPoly);
                    
                    tokSubset = repeatControlToks.slice(controlPtIndices[1], controlPtIndices[0]+controlToks.length+1);
                    newPathObj = createNewPathObj(origPathObj, tokSubset, closedPoly);
                    
                    origPathObj.remove();
                    commit();
                }
            }
            catch(err) {
                sendChat(scriptName, '/w gm Unhandled Error: ' + err.message);
            }
        }
        
        //******************************************************************************************************
        //FINISH EDITING PATH
        //******************************************************************************************************
        if (msg.type === "api" && msg.content.toLowerCase().indexOf("!path_snap")==0) {
            state[scriptName].snapToGrid = !state[scriptName].snapToGrid
            sendChat(scriptName, `/w gm Path ControlPt grid snapping set to ${state[scriptName].snapToGrid}!`);
        }
        
        //******************************************************************************************************
        //FINISH EDITING PATH
        //******************************************************************************************************
        if (msg.type === "api" && msg.content.toLowerCase().indexOf("!path_done")==0) {
            commit();
        }
        
        //******************************************************************************************************
        //SIMPLIFY PATH
        //******************************************************************************************************
        if (msg.type === "api" && msg.content.toLowerCase().indexOf("!path_simplify")==0) {
            try {
                //first closeout any actively edited paths  
                commit();
                
                //simplify the  path
                let tolerance = 5;  //default value
                let cmd = msg.content.split(" ");
                if (cmd.length > 1) {
                    if (isNumber(parseInt(cmd[1]))) {
                        tolerance = parseInt(cmd[1]);
                    }
                }
                
                if (msg.selected !== undefined) {
                    let selected = msg.selected[0];
                    if (selected) {
                        let pathObj = findObjs({
                          _type: 'path',
                          _id: selected._id
                        })[0];
                        //log(pathObj)
                        
                        if (pathObj) {
                            
                            let spawnObj = getCharacterFromName(editPtCharName);
                            if (spawnObj === undefined) {
                                sendChat(scriptName,`/w gm Error: Character \"${controlTokName}\" must be in the journal with a default token `);
                                return;
                            }
                            
                            let vertices = [];
                            let path = JSON.parse(pathObj.get("path"));
                            let closedPoly = path.find(el => el[0] === 'Z') ? true : false;
                            
                            let center = new pt(pathObj.get("left"), pathObj.get("top"));
                            let w = pathObj.get("width");
                            let h = pathObj.get("height");
                            let rot = degreesToRadians(pathObj.get("rotation"));
                            let scaleX = pathObj.get("scaleX");
                            let scaleY = pathObj.get("scaleY");
                            let pageID = pathObj.get("pageid");
                            let layer = pathObj.get("layer");
                            let pathColor = pathObj.get("stroke");
                            let editTokColor = getEditColor(pathColor);
                            let editTokSide = editTokColor==='#000000' ? 1 : 2;
                            
                            // closed polygons will have an extra copy of the first point, plus a final array element ["Z"]. 
                            //      we want to remove those before proceeding
                            if (closedPoly) {
                                path = path.slice(0, -2);
                            }
                            
                            //covert path vertices from relative coords to actual map coords
                            path.forEach((vert) => {
                                let tempPt = convertPtPathToMapCoords(vert, center, w, h, rot, scaleX, scaleY);
                                vertices.push(tempPt)
                            });
                            
                            //This actually does the simplifying!!!
                            let newPtsArr = simplify(vertices, tolerance, true);
                            newPathObj = await createNewPathObj(pathObj, newPtsArr, closedPoly);
                    
                            //remove original path
                            pathObj.remove();
                            
                            //start spawning path editing points at each vertex
                            (function(pts){ //start wrapper code to allow callback function to reference the array of vertices
                                spawnObj.get("_defaulttoken", async function(defaultToken) {
                                    let controlToks = [];
                                    let tok;
                                    for (let i=0; i<pts.length; i++) {
                                        editTok = await spawnTokenAtXY(defaultToken, pageID, pts[i].x, pts[i].y, defaultPtSize, 'all', true, editTokSide, layer);
                                        tok = {
                                            id: editTok.get("_id"),
                                            x: pts[i].x,
                                            y: pts[i].y
                                        }
                                        controlToks.push(tok);
                                    }
                                    
                                    let link = makePathEditLink(newPathObj.get("_id"), controlToks, closedPoly)
                                });
                            })(newPtsArr);//passing in loop element to thisPt here
                            
                            
                        } else {
                            sendChat(scriptName, '/w gm Error: You must select a valid path object to proceed');
                        }
                    } else {
                         sendChat(scriptName, '/w gm Error: You must select a valid path object to proceed');
                    }
                }
            }
            catch(err) {
                sendChat(scriptName, '/w gm Unhandled Error: ' + err.message);
            }
        }
        
        //******************************************************************************************************
        //START EDITING PATH
        //******************************************************************************************************
        if (msg.type === "api" && msg.content.toLowerCase().indexOf("!path_edit")==0) {
        
            try {
                //first closeout any actively edited paths  
                commit();
                //start editing new path
                if (msg.selected !== undefined) {
                    let selected = msg.selected[0];
                    if (selected) {
                        let pathObj = findObjs({
                          _type: 'path',
                          _id: selected._id
                        })[0];
                        //log(pathObj)
                        
                        if (pathObj) {
                            
                            let spawnObj = getCharacterFromName(editPtCharName);
                            if (spawnObj === undefined) {
                                sendChat(scriptName,`/w gm Error: Character \"${controlTokName}\" must be in the journal with a default token `);
                                return;
                            }
                            
                            let vertices = [];
                            let path = JSON.parse(pathObj.get("path"));
                            let closedPoly = path.find(el => el[0] === 'Z') ? true : false;
                            
                            let center = new pt(pathObj.get("left"), pathObj.get("top"));
                            let w = pathObj.get("width");
                            let h = pathObj.get("height");
                            let rot = degreesToRadians(pathObj.get("rotation"));
                            let scaleX = pathObj.get("scaleX");
                            let scaleY = pathObj.get("scaleY");
                            let pageID = pathObj.get("pageid");
                            let layer = pathObj.get("layer");
                            let pathColor = pathObj.get("stroke");
                            let editTokColor = getEditColor(pathColor);
                            let editTokSide = editTokColor==='#000000' ? 1 : 2;
                            
                            // closed polygons will have an extra copy of the first point, plus a final array element ["Z"]. 
                            //      we want to remove those before proceeding
                            if (closedPoly) {
                                path = path.slice(0, -2);
                            }
                            
                            //covert path vertices from relative coords to actual map coords
                            path.forEach((vert) => {
                                let tempPt = convertPtPathToMapCoords(vert, center, w, h, rot, scaleX, scaleY);
                                vertices.push(tempPt)
                            });
                            
                            //start spawning path editing points at each vertex
                            (function(pts){ //start wrapper code to allow callback function to reference the array of vertices
                                spawnObj.get("_defaulttoken", async function(defaultToken) {
                                    let controlToks = [];
                                    let tok;
                                    for (let i=0; i<pts.length; i++) {
                                        editTok = await spawnTokenAtXY(defaultToken, pageID, pts[i].x, pts[i].y, defaultPtSize, 'all', true, editTokSide, layer);
                                        tok = {
                                            id: editTok.get("_id"),
                                            x: pts[i].x,
                                            y: pts[i].y
                                        }
                                        controlToks.push(tok);
                                    }
                                    let link = makePathEditLink(pathObj.get("_id"), controlToks, closedPoly)
                                });
                            })(vertices);//passing in loop element to thisPt here
                            
                            
                        } else {
                            sendChat(scriptName, '/w gm Error: You must select a valid path object to proceed');
                        }
                    } else {
                         sendChat(scriptName, '/w gm Error: You must select a valid path object to proceed');
                    }
                }
            }
            catch(err) {
                sendChat(scriptName, '/w gm Unhandled Error: ' + err.message);
            }
        }
    };
    const registerEventHandlers = () => {
        on('chat:message', pathEditor_HandleInput);
        on('change:graphic', pathEditor_handleObjChange);
        on('change:path', pathEditor_handleObjChange);
        //on('destroy:graphic', pathEditor_handleRemoveToken);
        on('destroy:path', pathEditor_handleRemovePath);
    };
    on('ready', () => {
        checkInstall();
        registerEventHandlers();
    });
    
})();
