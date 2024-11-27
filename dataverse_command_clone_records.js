var MarksDevCommandButtons = {

    cloneRecordsClick: function (selCount, selIds, selRefs, typeName) {
        duplicateRecords(selRefs);
    },

    __namespace: true
};

//function to remove non-cloneable columns from the original record based on prefix
function filterProperties(obj, predicate) {
    for (const key in obj) {
        if (predicate(key)) {
            console.log(`deleting ${key}`);
            console.log(obj[key]);
            delete obj[key];
        }
    }
    return obj;
}

//clone records function
async function duplicateRecords(selRecs) {

    //alert if no records in selection (should never run as button won't show up if nothing selected)
    if (!selRecs || selRecs.length === 0) {
        Xrm.Navigation.openAlertDialog({ text: `No records selected.` });
        return;
    }

    //get the logical name of the dataverse table from the first record in the selection array
    const tableName = selRecs[0].TypeName; // Logical name of the table

    //create promises so we can trigger refresh once all records have been copied
    const createPromises = [];

    for (const record of selRecs) {
        try {
            // Get the full details of the selected record with Xrm.WebApi, including the image column
            Xrm.WebApi.retrieveRecord(tableName, record.Id).then(function(result1){console.log('Original Xrm Retrieve',result1);}).catch(function (error) {
                console.error("Error retrieving record:", error.message);
            });
            
            const recordPromise = Xrm.WebApi.retrieveRecord(tableName, record.Id)
                .then(function (result) {
                    console.log(`result: `,result);
                    const recordPrime = result; // Save the retrieved record

                    

                    // Remove properties starting with "_" or containing "@odata"
                    const recordNew = filterProperties(recordPrime, key => key.startsWith("_") || key.includes("@odata"));

                    //Remove the primary key column
                    delete recordNew["mln_simpleimagetestid"]; 

                    // Add " (copy)" to the name property
                    if (recordNew.mln_name) {
                        recordNew.mln_name += " (copy)";
                    }

                    // create account record
                    return Xrm.WebApi.createRecord(tableName, recordNew)
                        .then(function (result) {
                        // Successfully created new record
                        })
                        .catch(function (error) {
                            Xrm.Navigation.openAlertDialog({ text: `Error creating record: ${error.message}` });
                            console.log(`Xrm.WebApi Error: ${error.message}`);
                        });
                })
                .catch(function (error) {
                    console.error("Error retrieving record:", error.message);
                });

            // Add the promise to the array
            createPromises.push(recordPromise);

        } catch (error) {
            console.error("Error duplicating record: ", error);
            Xrm.Navigation.openAlertDialog({ text: `Error duplicating record with ID: ${record.Id}` });
        }
    }

    // Wait for all create record operations to complete
    await Promise.all(createPromises);

    // Alert after all records have been duplicated
    Xrm.Navigation.openAlertDialog({ text: `${selRecs.length} Record(s) duplicated successfully!` });

    // Refresh the page after all records have been duplicated
    var pageInput = {
        pageType: "entitylist",
        entityName: tableName
    };
    Xrm.Navigation.navigateTo(pageInput).then(
        function success() {
            // Run code on success
        },
        function error() {
            // Handle errors
        }
    );
}
